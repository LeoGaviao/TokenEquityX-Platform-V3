// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./AssetToken.sol";
import "./ComplianceManager.sol";

/**
 * @title P2PTransferModule
 * @notice Peer-to-peer token transfers for TokenEquityX V2.
 *         Used when market state is P2P_ONLY or for off-exchange transfers.
 *         Supports:
 *         - Direct transfers (gift/inheritance)
 *         - Escrow-based P2P trades (buyer locks USDC, seller sends tokens)
 *         - Transfer requests with expiry
 *         All transfers validated by ComplianceManager.
 */
contract P2PTransferModule is AccessControl, ReentrancyGuard, Pausable {

    // ─── ROLES ────────────────────────────────────────────────────
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ─── ENUMS ────────────────────────────────────────────────────
    enum EscrowStatus {
        PENDING,
        COMPLETED,
        CANCELLED,
        EXPIRED
    }

    // ─── STRUCTS ──────────────────────────────────────────────────
    struct EscrowTrade {
        bytes32     escrowId;
        address     token;
        address     seller;
        address     buyer;
        uint256     tokenAmount;
        uint256     usdcAmount;
        uint256     createdAt;
        uint256     expiresAt;
        EscrowStatus status;
        bool        sellerDeposited;
        bool        buyerDeposited;
    }

    struct TransferRecord {
        address token;
        address from;
        address to;
        uint256 amount;
        string  reason;
        uint256 timestamp;
    }

    // ─── STATE ────────────────────────────────────────────────────
    IERC20            public immutable usdc;
    ComplianceManager public immutable compliance;

    uint256 public escrowCount;
    uint256 public defaultEscrowExpiry = 48 hours;
    uint256 public p2pFeeBps           = 25; // 0.25% for P2P trades
    address public feeCollector;

    mapping(bytes32 => EscrowTrade)  public escrows;
    mapping(address => bytes32[])    public userEscrows;
    TransferRecord[]                 public transferHistory;

    // ─── EVENTS ───────────────────────────────────────────────────
    event DirectTransfer(
        address indexed token,
        address indexed from,
        address indexed to,
        uint256         amount,
        string          reason
    );
    event EscrowCreated(
        bytes32 indexed escrowId,
        address indexed token,
        address         seller,
        address         buyer,
        uint256         tokenAmount,
        uint256         usdcAmount,
        uint256         expiresAt
    );
    event EscrowSellerDeposited(bytes32 indexed escrowId);
    event EscrowBuyerDeposited(bytes32 indexed escrowId);
    event EscrowCompleted(
        bytes32 indexed escrowId,
        address         seller,
        address         buyer,
        uint256         tokenAmount,
        uint256         usdcAmount
    );
    event EscrowCancelled(bytes32 indexed escrowId, string reason);
    event EscrowExpired(bytes32 indexed escrowId);

    // ─── CONSTRUCTOR ──────────────────────────────────────────────
    constructor(
        address _usdc,
        address _compliance,
        address _feeCollector
    ) {
        require(_usdc         != address(0), "Invalid USDC");
        require(_compliance   != address(0), "Invalid compliance");
        require(_feeCollector != address(0), "Invalid fee collector");

        usdc         = IERC20(_usdc);
        compliance   = ComplianceManager(_compliance);
        feeCollector = _feeCollector;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE,      msg.sender);
    }

    // ─── DIRECT TRANSFER ──────────────────────────────────────────

    /**
     * @notice Direct compliant transfer between two wallets.
     *         Used for gifts, inheritance, internal transfers.
     *         No payment involved — pure token transfer.
     */
    function directTransfer(
        address         token,
        address         to,
        uint256         amount,
        string calldata reason
    ) external nonReentrant whenNotPaused {
        require(token  != address(0), "Invalid token");
        require(to     != address(0), "Invalid recipient");
        require(amount >  0,          "Zero amount");

        // Compliance validated inside AssetToken._update()
        AssetToken(token).transferFrom(msg.sender, to, amount);

        transferHistory.push(TransferRecord({
            token:     token,
            from:      msg.sender,
            to:        to,
            amount:    amount,
            reason:    reason,
            timestamp: block.timestamp
        }));

        emit DirectTransfer(token, msg.sender, to, amount, reason);
    }

    // ─── ESCROW P2P TRADE ─────────────────────────────────────────

    /**
     * @notice Create an escrow-based P2P trade.
     *         Seller and buyer agree off-platform on price and terms.
     *         Either party can initiate — both must deposit.
     */
    function createEscrow(
        address token,
        address seller,
        address buyer,
        uint256 tokenAmount,
        uint256 usdcAmount,
        uint256 expiryHours
    ) external onlyRole(OPERATOR_ROLE) returns (bytes32) {
        require(token      != address(0), "Invalid token");
        require(seller     != address(0), "Invalid seller");
        require(buyer      != address(0), "Invalid buyer");
        require(seller     != buyer,      "Self-trade");
        require(tokenAmount > 0,          "Zero tokens");
        require(usdcAmount  > 0,          "Zero USDC");

        // Compliance check
        compliance.canTransfer(seller, buyer, tokenAmount);

        bytes32 escrowId = keccak256(
            abi.encodePacked(token, seller, buyer, tokenAmount, block.timestamp)
        );
        require(escrows[escrowId].escrowId == bytes32(0), "Escrow exists");

        uint256 expiry = block.timestamp +
            ((expiryHours > 0 ? expiryHours : 48) * 1 hours);

        escrows[escrowId] = EscrowTrade({
            escrowId:         escrowId,
            token:            token,
            seller:           seller,
            buyer:            buyer,
            tokenAmount:      tokenAmount,
            usdcAmount:       usdcAmount,
            createdAt:        block.timestamp,
            expiresAt:        expiry,
            status:           EscrowStatus.PENDING,
            sellerDeposited:  false,
            buyerDeposited:   false
        });

        userEscrows[seller].push(escrowId);
        userEscrows[buyer].push(escrowId);

        emit EscrowCreated(
            escrowId, token, seller, buyer,
            tokenAmount, usdcAmount, expiry
        );

        return escrowId;
    }

    /**
     * @notice Seller deposits tokens into escrow.
     */
    function sellerDeposit(bytes32 escrowId)
        external nonReentrant whenNotPaused
    {
        EscrowTrade storage e = escrows[escrowId];
        require(e.status     == EscrowStatus.PENDING, "Not pending");
        require(msg.sender   == e.seller,             "Not seller");
        require(!e.sellerDeposited,                   "Already deposited");
        require(block.timestamp < e.expiresAt,        "Escrow expired");

        AssetToken(e.token).transferFrom(msg.sender, address(this), e.tokenAmount);
        e.sellerDeposited = true;

        emit EscrowSellerDeposited(escrowId);

        if (e.buyerDeposited) _settleEscrow(escrowId);
    }

    /**
     * @notice Buyer deposits USDC into escrow.
     */
    function buyerDeposit(bytes32 escrowId)
        external nonReentrant whenNotPaused
    {
        EscrowTrade storage e = escrows[escrowId];
        require(e.status    == EscrowStatus.PENDING, "Not pending");
        require(msg.sender  == e.buyer,              "Not buyer");
        require(!e.buyerDeposited,                   "Already deposited");
        require(block.timestamp < e.expiresAt,       "Escrow expired");

        usdc.transferFrom(msg.sender, address(this), e.usdcAmount);
        e.buyerDeposited = true;

        emit EscrowBuyerDeposited(escrowId);

        if (e.sellerDeposited) _settleEscrow(escrowId);
    }

    /**
     * @notice Internal: settle escrow once both parties have deposited.
     */
    function _settleEscrow(bytes32 escrowId) internal {
        EscrowTrade storage e = escrows[escrowId];

        uint256 fee            = (e.usdcAmount * p2pFeeBps) / 10000;
        uint256 sellerReceives = e.usdcAmount - fee;

        e.status = EscrowStatus.COMPLETED;

        // Tokens to buyer
        AssetToken(e.token).transfer(e.buyer, e.tokenAmount);

        // USDC to seller (minus fee)
        usdc.transfer(e.seller, sellerReceives);

        // Fee to collector
        if (fee > 0) usdc.transfer(feeCollector, fee);

        emit EscrowCompleted(
            escrowId, e.seller, e.buyer, e.tokenAmount, e.usdcAmount
        );
    }

    /**
     * @notice Cancel an escrow and refund both parties.
     */
    function cancelEscrow(bytes32 escrowId, string calldata reason)
        external
    {
        EscrowTrade storage e = escrows[escrowId];
        require(e.status == EscrowStatus.PENDING, "Not pending");
        require(
            msg.sender == e.seller   ||
            msg.sender == e.buyer    ||
            hasRole(OPERATOR_ROLE, msg.sender),
            "Not authorised"
        );

        e.status = EscrowStatus.CANCELLED;

        // Refund seller tokens if deposited
        if (e.sellerDeposited) {
            AssetToken(e.token).transfer(e.seller, e.tokenAmount);
        }

        // Refund buyer USDC if deposited
        if (e.buyerDeposited) {
            usdc.transfer(e.buyer, e.usdcAmount);
        }

        emit EscrowCancelled(escrowId, reason);
    }

    /**
     * @notice Expire an escrow that has passed its deadline.
     */
    function expireEscrow(bytes32 escrowId) external {
        EscrowTrade storage e = escrows[escrowId];
        require(e.status     == EscrowStatus.PENDING, "Not pending");
        require(block.timestamp >= e.expiresAt,       "Not expired");

        e.status = EscrowStatus.EXPIRED;

        if (e.sellerDeposited) {
            AssetToken(e.token).transfer(e.seller, e.tokenAmount);
        }
        if (e.buyerDeposited) {
            usdc.transfer(e.buyer, e.usdcAmount);
        }

        emit EscrowExpired(escrowId);
    }

    // ─── VIEW FUNCTIONS ───────────────────────────────────────────

    function getEscrow(bytes32 escrowId)
        external view returns (EscrowTrade memory)
    {
        return escrows[escrowId];
    }

    function getUserEscrows(address user)
        external view returns (bytes32[] memory)
    {
        return userEscrows[user];
    }

    function getTransferHistoryLength()
        external view returns (uint256)
    {
        return transferHistory.length;
    }

    // ─── ADMIN ────────────────────────────────────────────────────

    function setP2PFeeBps(uint256 bps)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(bps <= 200, "Max 2%");
        p2pFeeBps = bps;
    }

    function setFeeCollector(address newCollector)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(newCollector != address(0), "Invalid address");
        feeCollector = newCollector;
    }

    function pause()   external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}