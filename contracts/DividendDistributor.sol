// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./AssetToken.sol";

/**
 * @title DividendDistributor
 * @notice Pull-based dividend and coupon distribution for TokenEquityX V2.
 *         Handles both equity dividends and bond coupon payments.
 *         Company/issuer deposits USDC, token holders claim proportionally.
 *         Uses pull pattern to avoid gas exhaustion on large holder sets.
 *         Unclaimed funds swept to treasury after deadline.
 */
contract DividendDistributor is AccessControl, ReentrancyGuard, Pausable {

    // ─── ROLES ────────────────────────────────────────────────────
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant SWEEPER_ROLE     = keccak256("SWEEPER_ROLE");

    // ─── ENUMS ────────────────────────────────────────────────────
    enum RoundType {
        DIVIDEND,   // equity dividend
        COUPON,     // bond coupon payment
        SPECIAL     // special distribution
    }

    // ─── STRUCTS ──────────────────────────────────────────────────
    struct DistributionRound {
        uint256   id;
        address   token;            // AssetToken address
        RoundType roundType;
        uint256   totalAmount;      // total USDC deposited
        uint256   snapshotSupply;   // total supply at snapshot
        uint256   snapshotBlock;
        uint256   depositTime;
        uint256   claimDeadline;
        uint256   totalClaimed;
        bool      active;
        string    description;      // e.g. "Q3 2025 Dividend"
        address   depositor;
    }

    // ─── STATE ────────────────────────────────────────────────────
    IERC20  public immutable usdc;
    address public           treasury;

    uint256 public roundCount;
    mapping(uint256 => DistributionRound)                       public rounds;
    mapping(uint256 => mapping(address => bool))                public claimed;
    mapping(uint256 => mapping(address => uint256))             public claimAmounts;
    mapping(address => uint256[])                               public tokenRounds;

    // ─── EVENTS ───────────────────────────────────────────────────
    event RoundCreated(
        uint256 indexed roundId,
        address indexed token,
        RoundType       roundType,
        uint256         amount,
        uint256         claimDeadline,
        string          description
    );
    event Claimed(
        uint256 indexed roundId,
        address indexed claimant,
        uint256         amount
    );
    event RoundSwept(
        uint256 indexed roundId,
        uint256         unclaimedAmount,
        address         treasury
    );
    event TreasuryUpdated(address newTreasury);

    // ─── CONSTRUCTOR ──────────────────────────────────────────────
    constructor(address _usdc, address _treasury) {
        require(_usdc     != address(0), "Invalid USDC");
        require(_treasury != address(0), "Invalid treasury");

        usdc     = IERC20(_usdc);
        treasury = _treasury;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE,   msg.sender);
        _grantRole(SWEEPER_ROLE,       msg.sender);
    }

    // ─── CREATE DISTRIBUTION ROUND ────────────────────────────────

    /**
     * @notice Create a new distribution round.
     *         Caller must approve this contract to spend USDC first.
     * @param token           AssetToken address
     * @param roundType       DIVIDEND, COUPON, or SPECIAL
     * @param amount          Total USDC to distribute
     * @param claimWindowDays Days investors have to claim
     * @param description     Human readable description
     */
    function createRound(
        address         token,
        RoundType       roundType,
        uint256         amount,
        uint256         claimWindowDays,
        string calldata description
    ) external onlyRole(DISTRIBUTOR_ROLE) whenNotPaused returns (uint256) {
        require(token  != address(0), "Invalid token");
        require(amount >  0,          "Zero amount");
        require(claimWindowDays >= 7, "Min 7 days");

        uint256 supply = AssetToken(token).totalSupply();
        require(supply > 0, "No tokens issued");

        // Transfer USDC from caller to this contract
        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        require(ok, "USDC transfer failed");

        roundCount++;
        uint256 id = roundCount;

        rounds[id] = DistributionRound({
            id:             id,
            token:          token,
            roundType:      roundType,
            totalAmount:    amount,
            snapshotSupply: supply,
            snapshotBlock:  block.number,
            depositTime:    block.timestamp,
            claimDeadline:  block.timestamp + (claimWindowDays * 1 days),
            totalClaimed:   0,
            active:         true,
            description:    description,
            depositor:      msg.sender
        });

        tokenRounds[token].push(id);

        emit RoundCreated(id, token, roundType, amount, rounds[id].claimDeadline, description);
        return id;
    }

    // ─── CLAIM ────────────────────────────────────────────────────

    /**
     * @notice Investor claims their share of a distribution round.
     *         Formula: (investorBalance / totalSupply) * totalAmount
     */
    function claim(uint256 roundId)
        external nonReentrant whenNotPaused
    {
        DistributionRound storage r = rounds[roundId];
        require(r.active,                              "Round not active");
        require(block.timestamp <= r.claimDeadline,   "Claim window closed");
        require(!claimed[roundId][msg.sender],         "Already claimed");

        uint256 balance = AssetToken(r.token).balanceOf(msg.sender);
        require(balance > 0, "No token balance");

        uint256 due = (balance * r.totalAmount) / r.snapshotSupply;
        require(due > 0, "Nothing to claim");

        claimed[roundId][msg.sender]      = true;
        claimAmounts[roundId][msg.sender] = due;
        r.totalClaimed                   += due;

        bool ok = usdc.transfer(msg.sender, due);
        require(ok, "USDC payment failed");

        emit Claimed(roundId, msg.sender, due);
    }

    /**
     * @notice Claim multiple rounds in one transaction.
     */
    function claimMultiple(uint256[] calldata roundIds)
        external nonReentrant whenNotPaused
    {
        uint256 totalDue = 0;

        for (uint256 i = 0; i < roundIds.length; i++) {
            uint256 roundId = roundIds[i];
            DistributionRound storage r = rounds[roundId];

            if (!r.active)                              continue;
            if (block.timestamp > r.claimDeadline)     continue;
            if (claimed[roundId][msg.sender])           continue;

            uint256 balance = AssetToken(r.token).balanceOf(msg.sender);
            if (balance == 0) continue;

            uint256 due = (balance * r.totalAmount) / r.snapshotSupply;
            if (due == 0) continue;

            claimed[roundId][msg.sender]      = true;
            claimAmounts[roundId][msg.sender] = due;
            r.totalClaimed                   += due;
            totalDue                         += due;

            emit Claimed(roundId, msg.sender, due);
        }

        if (totalDue > 0) {
            bool ok = usdc.transfer(msg.sender, totalDue);
            require(ok, "USDC payment failed");
        }
    }

    // ─── SWEEP UNCLAIMED ──────────────────────────────────────────

    /**
     * @notice Sweep unclaimed funds to treasury after deadline.
     */
    function sweepUnclaimed(uint256 roundId)
        external onlyRole(SWEEPER_ROLE)
    {
        DistributionRound storage r = rounds[roundId];
        require(r.active,                            "Already swept");
        require(block.timestamp > r.claimDeadline,  "Window still open");

        r.active = false;
        uint256 unclaimed = r.totalAmount - r.totalClaimed;

        if (unclaimed > 0) {
            bool ok = usdc.transfer(treasury, unclaimed);
            require(ok, "Sweep failed");
        }

        emit RoundSwept(roundId, unclaimed, treasury);
    }

    // ─── VIEW FUNCTIONS ───────────────────────────────────────────

    function previewClaim(uint256 roundId, address investor)
        external view returns (uint256)
    {
        DistributionRound storage r = rounds[roundId];
        if (!r.active)                          return 0;
        if (claimed[roundId][investor])         return 0;
        if (block.timestamp > r.claimDeadline) return 0;

        uint256 balance = AssetToken(r.token).balanceOf(investor);
        if (balance == 0) return 0;

        return (balance * r.totalAmount) / r.snapshotSupply;
    }

    function getTokenRounds(address token)
        external view returns (uint256[] memory)
    {
        return tokenRounds[token];
    }

    function getClaimableRounds(address token, address investor)
        external view returns (uint256[] memory)
    {
        uint256[] storage ids = tokenRounds[token];
        uint256 count = 0;

        for (uint256 i = 0; i < ids.length; i++) {
            DistributionRound storage r = rounds[ids[i]];
            if (r.active
                && block.timestamp <= r.claimDeadline
                && !claimed[ids[i]][investor]
                && AssetToken(r.token).balanceOf(investor) > 0)
            {
                count++;
            }
        }

        uint256[] memory claimable = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            DistributionRound storage r = rounds[ids[i]];
            if (r.active
                && block.timestamp <= r.claimDeadline
                && !claimed[ids[i]][investor]
                && AssetToken(r.token).balanceOf(investor) > 0)
            {
                claimable[idx++] = ids[i];
            }
        }

        return claimable;
    }

    // ─── ADMIN ────────────────────────────────────────────────────

    function setTreasury(address newTreasury)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(newTreasury != address(0), "Invalid address");
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function pause()   external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}