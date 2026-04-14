// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./AssetToken.sol";

/**
 * @title DebtManager
 * @notice Manages tokenized debt instruments (bonds) on TokenEquityX V2.
 *         Handles:
 *         - Bond issuance parameters (face value, coupon, maturity)
 *         - Coupon payment scheduling and distribution
 *         - Redemption escrow — issuer deposits principal before maturity
 *         - Investor redemption claims at maturity
 *         - Early redemption with penalty
 */
contract DebtManager is AccessControl, ReentrancyGuard, Pausable {

    // ─── ROLES ────────────────────────────────────────────────────
    bytes32 public constant DEBT_ADMIN_ROLE = keccak256("DEBT_ADMIN_ROLE");
    bytes32 public constant ISSUER_ROLE     = keccak256("ISSUER_ROLE");

    // ─── ENUMS ────────────────────────────────────────────────────
    enum BondStatus {
        ACTIVE,
        MATURED,
        REDEEMED,
        DEFAULTED
    }

    // ─── STRUCTS ──────────────────────────────────────────────────
    struct Bond {
        address    token;
        uint256    faceValuePerToken;
        uint256    couponRateBps;
        uint256    couponFrequency;
        uint256    maturityDate;
        uint256    issuanceDate;
        uint256    lastCouponDate;
        uint256    nextCouponDate;
        uint256    totalCouponsIssued;
        uint256    escrowBalance;
        uint256    totalRedeemed;
        BondStatus status;
        bool       earlyRedemptionAllowed;
        uint256    earlyRedemptionPenaltyBps;
    }

    struct RedemptionClaim {
        address investor;
        uint256 tokenAmount;
        uint256 usdcAmount;
        uint256 claimedAt;
    }

    // ─── STATE ────────────────────────────────────────────────────
    IERC20  public immutable usdc;
    address public           treasury;

    mapping(address => Bond)                            public bonds;
    mapping(address => mapping(address => bool))        public redeemed;
    mapping(address => mapping(address => uint256))     public redeemedAmount;
    mapping(address => RedemptionClaim[])               public redemptionHistory;
    address[]                                           public allBonds;

    // ─── EVENTS ───────────────────────────────────────────────────
    event BondRegistered(
        address indexed token,
        uint256         faceValuePerToken,
        uint256         couponRateBps,
        uint256         maturityDate
    );
    event CouponScheduled(
        address indexed token,
        uint256         couponRound,
        uint256         totalAmount,
        uint256         nextCouponDate
    );
    event EscrowDeposited(
        address indexed token,
        address indexed depositor,
        uint256         amount,
        uint256         totalEscrow
    );
    event BondRedeemed(
        address indexed token,
        address indexed investor,
        uint256         tokenAmount,
        uint256         usdcAmount
    );
    event BondMatured(address indexed token);
    event BondDefaulted(address indexed token, string reason);
    event EarlyRedemption(
        address indexed token,
        address indexed investor,
        uint256         tokenAmount,
        uint256         usdcAmount,
        uint256         penalty
    );

    // ─── CONSTRUCTOR ──────────────────────────────────────────────
    constructor(address _usdc, address _treasury) {
        require(_usdc     != address(0), "Invalid USDC");
        require(_treasury != address(0), "Invalid treasury");

        usdc     = IERC20(_usdc);
        treasury = _treasury;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DEBT_ADMIN_ROLE,    msg.sender);
        _grantRole(ISSUER_ROLE,        msg.sender);
    }

    // ─── BOND REGISTRATION ────────────────────────────────────────

    function registerBond(
        address token,
        uint256 faceValuePerToken,
        uint256 couponRateBps,
        uint256 couponFrequency,
        uint256 maturityDate,
        bool    earlyRedemptionAllowed,
        uint256 earlyRedemptionPenaltyBps
    ) external onlyRole(DEBT_ADMIN_ROLE) {
        require(token             != address(0),      "Invalid token");
        require(faceValuePerToken >  0,               "Zero face value");
        require(maturityDate      >  block.timestamp, "Maturity in past");
        require(couponFrequency   >  0,               "Zero frequency");
        require(bonds[token].token == address(0),     "Already registered");

        bonds[token] = Bond({
            token:                     token,
            faceValuePerToken:         faceValuePerToken,
            couponRateBps:             couponRateBps,
            couponFrequency:           couponFrequency,
            maturityDate:              maturityDate,
            issuanceDate:              block.timestamp,
            lastCouponDate:            block.timestamp,
            nextCouponDate:            block.timestamp + couponFrequency,
            totalCouponsIssued:        0,
            escrowBalance:             0,
            totalRedeemed:             0,
            status:                    BondStatus.ACTIVE,
            earlyRedemptionAllowed:    earlyRedemptionAllowed,
            earlyRedemptionPenaltyBps: earlyRedemptionPenaltyBps
        });

        allBonds.push(token);
        emit BondRegistered(token, faceValuePerToken, couponRateBps, maturityDate);
    }

    // ─── COUPON MANAGEMENT ────────────────────────────────────────

    function calculateCouponAmount(address token)
        public view returns (uint256)
    {
        Bond storage b = bonds[token];
        require(b.token != address(0), "Bond not registered");

        uint256 supply    = AssetToken(token).totalSupply();
        uint256 totalFace = (b.faceValuePerToken * supply) / 1e18;
        uint256 period    = b.couponFrequency;

        return (totalFace * b.couponRateBps * period) / (10000 * 365 days);
    }

    function getNextCouponAmount(address token)
        external view returns (uint256)
    {
        return calculateCouponAmount(token);
    }

    function isCouponDue(address token) external view returns (bool) {
        Bond storage b = bonds[token];
        return b.status == BondStatus.ACTIVE
            && block.timestamp >= b.nextCouponDate
            && block.timestamp <  b.maturityDate;
    }

    function recordCouponIssued(address token)
        external onlyRole(DEBT_ADMIN_ROLE)
    {
        Bond storage b = bonds[token];
        require(b.token  != address(0),       "Not registered");
        require(b.status == BondStatus.ACTIVE, "Bond not active");

        b.lastCouponDate     = block.timestamp;
        b.nextCouponDate     = block.timestamp + b.couponFrequency;
        b.totalCouponsIssued++;

        emit CouponScheduled(
            token,
            b.totalCouponsIssued,
            calculateCouponAmount(token),
            b.nextCouponDate
        );
    }

    // ─── REDEMPTION ESCROW ────────────────────────────────────────

    function depositRedemptionFunds(address token, uint256 amount)
        external onlyRole(ISSUER_ROLE) nonReentrant
    {
        Bond storage b = bonds[token];
        require(b.token  != address(0),       "Not registered");
        require(b.status == BondStatus.ACTIVE, "Bond not active");
        require(amount   >  0,                 "Zero amount");

        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        require(ok, "USDC transfer failed");

        b.escrowBalance += amount;
        emit EscrowDeposited(token, msg.sender, amount, b.escrowBalance);
    }

    function getRedemptionAmountNeeded(address token)
        external view returns (uint256)
    {
        Bond storage b = bonds[token];
        uint256 supply = AssetToken(token).totalSupply();
        return (b.faceValuePerToken * supply) / 1e18;
    }

    function isEscrowFunded(address token) external view returns (bool) {
        Bond storage b = bonds[token];
        uint256 supply = AssetToken(token).totalSupply();
        uint256 needed = (b.faceValuePerToken * supply) / 1e18;
        return b.escrowBalance >= needed;
    }

    // ─── BOND MATURITY ────────────────────────────────────────────

    function triggerMaturity(address token) external {
        Bond storage b = bonds[token];
        require(b.token  != address(0),           "Not registered");
        require(b.status == BondStatus.ACTIVE,     "Not active");
        require(block.timestamp >= b.maturityDate, "Not yet mature");

        uint256 supply = AssetToken(token).totalSupply();
        uint256 needed = (b.faceValuePerToken * supply) / 1e18;

        if (b.escrowBalance < needed) {
            b.status = BondStatus.DEFAULTED;
            emit BondDefaulted(token, "Insufficient escrow at maturity");
        } else {
            b.status = BondStatus.MATURED;
            emit BondMatured(token);
        }
    }

    // ─── INVESTOR REDEMPTION ──────────────────────────────────────

    function redeem(address token, uint256 tokenAmount)
        external nonReentrant whenNotPaused
    {
        Bond storage b = bonds[token];
        require(b.token  != address(0),        "Not registered");
        require(b.status == BondStatus.MATURED, "Bond not matured");
        require(!redeemed[token][msg.sender],   "Already redeemed");
        require(tokenAmount > 0,                "Zero amount");

        uint256 balance = AssetToken(token).balanceOf(msg.sender);
        require(tokenAmount <= balance, "Insufficient balance");

        uint256 usdcDue = (b.faceValuePerToken * tokenAmount) / 1e18;
        require(b.escrowBalance >= usdcDue, "Insufficient escrow");

        redeemed[token][msg.sender]       = true;
        redeemedAmount[token][msg.sender] = usdcDue;
        b.escrowBalance                  -= usdcDue;
        b.totalRedeemed                  += usdcDue;

        redemptionHistory[token].push(RedemptionClaim({
            investor:    msg.sender,
            tokenAmount: tokenAmount,
            usdcAmount:  usdcDue,
            claimedAt:   block.timestamp
        }));

        AssetToken(token).burnTokens(msg.sender, tokenAmount, "Bond redemption");

        bool ok = usdc.transfer(msg.sender, usdcDue);
        require(ok, "USDC transfer failed");

        if (AssetToken(token).totalSupply() == 0) {
            b.status = BondStatus.REDEEMED;
        }

        emit BondRedeemed(token, msg.sender, tokenAmount, usdcDue);
    }

    function earlyRedeem(address token, uint256 tokenAmount)
        external nonReentrant whenNotPaused
    {
        Bond storage b = bonds[token];
        require(b.token  != address(0),           "Not registered");
        require(b.status == BondStatus.ACTIVE,     "Not active");
        require(b.earlyRedemptionAllowed,          "Early redemption not allowed");
        require(block.timestamp < b.maturityDate,  "Use redeem() after maturity");
        require(!redeemed[token][msg.sender],      "Already redeemed");
        require(tokenAmount > 0,                   "Zero amount");

        uint256 balance = AssetToken(token).balanceOf(msg.sender);
        require(tokenAmount <= balance, "Insufficient balance");

        uint256 grossAmount = (b.faceValuePerToken * tokenAmount) / 1e18;
        uint256 penalty     = (grossAmount * b.earlyRedemptionPenaltyBps) / 10000;
        uint256 netAmount   = grossAmount - penalty;

        require(b.escrowBalance >= netAmount, "Insufficient escrow");

        b.escrowBalance -= netAmount;
        b.totalRedeemed += netAmount;

        if (penalty > 0 && b.escrowBalance >= penalty) {
            b.escrowBalance -= penalty;
            usdc.transfer(treasury, penalty);
        }

        AssetToken(token).burnTokens(
            msg.sender, tokenAmount, "Early bond redemption"
        );

        bool ok = usdc.transfer(msg.sender, netAmount);
        require(ok, "USDC transfer failed");

        emit EarlyRedemption(token, msg.sender, tokenAmount, netAmount, penalty);
    }

    // ─── VIEW FUNCTIONS ───────────────────────────────────────────

    function getBond(address token)
        external view returns (Bond memory)
    {
        return bonds[token];
    }

    function getAllBonds()
        external view returns (address[] memory)
    {
        return allBonds;
    }

    function getRedemptionHistory(address token)
        external view returns (RedemptionClaim[] memory)
    {
        return redemptionHistory[token];
    }

    function previewRedemption(address token, address investor)
        external view returns (uint256 usdcAmount, uint256 penalty)
    {
        Bond storage b   = bonds[token];
        uint256 balance  = AssetToken(token).balanceOf(investor);
        uint256 gross    = (b.faceValuePerToken * balance) / 1e18;

        if (b.status == BondStatus.MATURED) {
            return (gross, 0);
        } else if (b.earlyRedemptionAllowed) {
            penalty    = (gross * b.earlyRedemptionPenaltyBps) / 10000;
            usdcAmount = gross - penalty;
        }
    }

    // ─── ADMIN ────────────────────────────────────────────────────

    function markDefaulted(address token, string calldata reason)
        external onlyRole(DEBT_ADMIN_ROLE)
    {
        bonds[token].status = BondStatus.DEFAULTED;
        emit BondDefaulted(token, reason);
    }

    function setTreasury(address newTreasury)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(newTreasury != address(0), "Invalid address");
        treasury = newTreasury;
    }

    function pause()   external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
