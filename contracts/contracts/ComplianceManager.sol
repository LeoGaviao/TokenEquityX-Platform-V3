// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ComplianceManager
 * @notice Central compliance registry for TokenEquityX V2.
 *         Manages KYC, jurisdiction controls, investor limits,
 *         and freeze capabilities across all asset tokens.
 *         All asset tokens reference this single contract.
 */
contract ComplianceManager is AccessControl, Pausable {

    // ─── ROLES ────────────────────────────────────────────────────
    bytes32 public constant COMPLIANCE_OFFICER = keccak256("COMPLIANCE_OFFICER");
    bytes32 public constant KYC_AGENT          = keccak256("KYC_AGENT");
    bytes32 public constant AUDITOR_ROLE       = keccak256("AUDITOR_ROLE");

    // ─── ENUMS ────────────────────────────────────────────────────
    enum InvestorTier { NONE, RETAIL, ACCREDITED, INSTITUTIONAL }

    // ─── STRUCTS ──────────────────────────────────────────────────
    struct InvestorProfile {
        bool         kycApproved;
        bool         frozen;
        InvestorTier tier;
        uint8        jurisdictionCode;
        uint256      kycExpiry;
        uint256      maxHoldingBps;      // max % of any token supply (basis points)
        uint256      dailyTradeLimit;    // max USD value per day (6 decimals)
        uint256      dailyTradeUsed;     // USD traded today (6 decimals)
        uint256      dailyTradeReset;    // timestamp of last reset
        string       kycReference;      // off-chain KYC provider reference
    }

    // ─── STATE ────────────────────────────────────────────────────
    mapping(address => InvestorProfile)  public investors;
    mapping(uint8   => bool)             public blockedJurisdictions;
    mapping(address => bool)             public registeredTokens;

    uint256 public defaultDailyTradeLimit = 50_000 * 1e6; // $50,000 USDC default

    // ─── EVENTS ───────────────────────────────────────────────────
    event InvestorApproved(
        address indexed investor,
        InvestorTier    tier,
        uint8           jurisdiction,
        uint256         expiry
    );
    event InvestorRevoked(address indexed investor, string reason);
    event InvestorFrozen(address indexed investor, string reason);
    event InvestorUnfrozen(address indexed investor);
    event JurisdictionBlocked(uint8 code);
    event JurisdictionUnblocked(uint8 code);
    event TokenRegistered(address indexed token);
    event TradeLimitUpdated(address indexed investor, uint256 newLimit);
    event DailyTradeRecorded(address indexed investor, uint256 amount);

    // ─── CONSTRUCTOR ──────────────────────────────────────────────
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE,  msg.sender);
        _grantRole(COMPLIANCE_OFFICER,  msg.sender);
        _grantRole(KYC_AGENT,           msg.sender);
        _grantRole(AUDITOR_ROLE,        msg.sender);
    }

    // ─── KYC MANAGEMENT ───────────────────────────────────────────

    /// @notice Approve an investor after off-chain KYC verification
    function approveInvestor(
        address      investor,
        InvestorTier tier,
        uint8        jurisdictionCode,
        uint256      kycValidDays,
        uint256      maxHoldingBps,
        uint256      dailyTradeLimit,
        string calldata kycReference
    ) external onlyRole(KYC_AGENT) {
        require(investor != address(0),                     "Zero address");
        require(!blockedJurisdictions[jurisdictionCode],    "Jurisdiction blocked");
        require(maxHoldingBps <= 10000,                     "BPS > 100%");

        investors[investor] = InvestorProfile({
            kycApproved:      true,
            frozen:           false,
            tier:             tier,
            jurisdictionCode: jurisdictionCode,
            kycExpiry:        block.timestamp + (kycValidDays * 1 days),
            maxHoldingBps:    maxHoldingBps,
            dailyTradeLimit:  dailyTradeLimit > 0
                                ? dailyTradeLimit
                                : defaultDailyTradeLimit,
            dailyTradeUsed:   0,
            dailyTradeReset:  block.timestamp,
            kycReference:     kycReference
        });

        emit InvestorApproved(
            investor, tier, jurisdictionCode,
            investors[investor].kycExpiry
        );
    }

    /// @notice Revoke KYC — investor can no longer transact
    function revokeInvestor(address investor, string calldata reason)
        external onlyRole(COMPLIANCE_OFFICER)
    {
        investors[investor].kycApproved = false;
        emit InvestorRevoked(investor, reason);
    }

    /// @notice Freeze an investor account
    function freezeInvestor(address investor, string calldata reason)
        external onlyRole(COMPLIANCE_OFFICER)
    {
        investors[investor].frozen = true;
        emit InvestorFrozen(investor, reason);
    }

    /// @notice Unfreeze an investor account
    function unfreezeInvestor(address investor)
        external onlyRole(COMPLIANCE_OFFICER)
    {
        investors[investor].frozen = false;
        emit InvestorUnfrozen(investor);
    }

    // ─── JURISDICTION ─────────────────────────────────────────────

    function blockJurisdiction(uint8 code)
        external onlyRole(COMPLIANCE_OFFICER)
    {
        blockedJurisdictions[code] = true;
        emit JurisdictionBlocked(code);
    }

    function unblockJurisdiction(uint8 code)
        external onlyRole(COMPLIANCE_OFFICER)
    {
        blockedJurisdictions[code] = false;
        emit JurisdictionUnblocked(code);
    }

    // ─── TRADE LIMITS ─────────────────────────────────────────────

    /// @notice Record a trade — resets daily counter if new day
    function recordTrade(address investor, uint256 usdcAmount)
        external onlyRole(COMPLIANCE_OFFICER)
    {
        InvestorProfile storage p = investors[investor];

        // Reset daily counter if 24 hours have passed
        if (block.timestamp >= p.dailyTradeReset + 1 days) {
            p.dailyTradeUsed  = 0;
            p.dailyTradeReset = block.timestamp;
        }

        require(
            p.dailyTradeUsed + usdcAmount <= p.dailyTradeLimit,
            "Daily trade limit exceeded"
        );
        p.dailyTradeUsed += usdcAmount;
        emit DailyTradeRecorded(investor, usdcAmount);
    }

    function setDailyTradeLimit(address investor, uint256 limit)
        external onlyRole(COMPLIANCE_OFFICER)
    {
        investors[investor].dailyTradeLimit = limit;
        emit TradeLimitUpdated(investor, limit);
    }

    // ─── TOKEN REGISTRY ───────────────────────────────────────────

    function registerToken(address token)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        registeredTokens[token] = true;
        emit TokenRegistered(token);
    }

    // ─── TRANSFER VALIDATION ──────────────────────────────────────

    /// @notice Called by AssetToken on every transfer.
    ///         Returns true if compliant, reverts with reason if not.
    function canTransfer(
        address from,
        address to,
        uint256 /* amount */
    ) external view returns (bool) {
        // Skip checks for minting (from == 0) and burning (to == 0)
        if (from != address(0)) {
            require(investors[from].kycApproved,                  "Sender not KYC approved");
            require(!investors[from].frozen,                      "Sender account frozen");
            require(
                investors[from].kycExpiry > block.timestamp,
                "Sender KYC expired"
            );
            require(
                !blockedJurisdictions[investors[from].jurisdictionCode],
                "Sender jurisdiction blocked"
            );
        }
        if (to != address(0)) {
            require(investors[to].kycApproved,                    "Recipient not KYC approved");
            require(!investors[to].frozen,                        "Recipient account frozen");
            require(
                investors[to].kycExpiry > block.timestamp,
                "Recipient KYC expired"
            );
            require(
                !blockedJurisdictions[investors[to].jurisdictionCode],
                "Recipient jurisdiction blocked"
            );
        }
        return true;
    }

    // ─── VIEW HELPERS ─────────────────────────────────────────────

    function isApproved(address investor) external view returns (bool) {
        InvestorProfile storage p = investors[investor];
        return p.kycApproved
            && !p.frozen
            && p.kycExpiry > block.timestamp
            && !blockedJurisdictions[p.jurisdictionCode];
    }

    function getInvestorTier(address investor)
        external view returns (InvestorTier)
    {
        return investors[investor].tier;
    }

    function getRemainingDailyLimit(address investor)
        external view returns (uint256)
    {
        InvestorProfile storage p = investors[investor];
        if (block.timestamp >= p.dailyTradeReset + 1 days) {
            return p.dailyTradeLimit;
        }
        if (p.dailyTradeLimit <= p.dailyTradeUsed) return 0;
        return p.dailyTradeLimit - p.dailyTradeUsed;
    }

    // ─── ADMIN ────────────────────────────────────────────────────

    function pause()   external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    function setDefaultDailyTradeLimit(uint256 limit)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        defaultDailyTradeLimit = limit;
    }
}