// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PriceOracle
 * @notice Multi-source price oracle for TokenEquityX V2.
 *         Supports multiple updaters, data hashing for audit,
 *         and is designed for future multi-sig consensus (2-of-3).
 *         Prices stored with 8 decimals (Chainlink standard).
 */
contract PriceOracle is AccessControl, Pausable {

    // ─── ROLES ────────────────────────────────────────────────────
    bytes32 public constant ORACLE_UPDATER_ROLE = keccak256("ORACLE_UPDATER_ROLE");
    bytes32 public constant AUDITOR_ROLE        = keccak256("AUDITOR_ROLE");

    // ─── STRUCTS ──────────────────────────────────────────────────
    struct PriceData {
        uint256 price;
        uint256 timestamp;
        bytes32 dataHash;
        uint256 submissionId;
        address updatedBy;
        bool    auditorApproved;
        string  source;
    }

    struct PendingPrice {
        uint256 price;
        bytes32 dataHash;
        string  source;
        uint256 submittedAt;
        address submittedBy;
        bool    exists;
    }

    // ─── STATE ────────────────────────────────────────────────────
    mapping(address => PriceData)    public prices;
    mapping(address => PendingPrice) public pendingPrices;
    mapping(address => uint256)      public submissionIds;

    uint256 public priceValidityPeriod    = 7 days;
    bool    public requireAuditorApproval = false;

    // ─── EVENTS ───────────────────────────────────────────────────
    event PriceSubmitted(
        address indexed token,
        uint256         price,
        bytes32         dataHash,
        uint256         submissionId,
        address         submittedBy,
        string          source
    );
    event PriceApproved(
        address indexed token,
        uint256         price,
        address         approvedBy
    );
    event PriceRejected(
        address indexed token,
        string          reason,
        address         rejectedBy
    );
    event PriceUpdatedDirect(
        address indexed token,
        uint256         price,
        bytes32         dataHash,
        address         updatedBy,
        string          source
    );
    event AuditorApprovalToggled(bool required);
    event PriceValidityUpdated(uint256 newPeriod);

    // ─── CONSTRUCTOR ──────────────────────────────────────────────
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE,  msg.sender);
        _grantRole(ORACLE_UPDATER_ROLE, msg.sender);
        _grantRole(AUDITOR_ROLE,        msg.sender);
    }

    // ─── PRICE UPDATES ────────────────────────────────────────────

    function updatePrice(
        address         token,
        uint256         price,
        bytes32         dataHash,
        string calldata source
    ) external onlyRole(ORACLE_UPDATER_ROLE) whenNotPaused {
        require(token != address(0), "Zero address");
        require(price > 0,           "Price must be > 0");
        require(!requireAuditorApproval, "Auditor approval required - use submitPrice");

        uint256 subId = ++submissionIds[token];

        prices[token] = PriceData({
            price:           price,
            timestamp:       block.timestamp,
            dataHash:        dataHash,
            submissionId:    subId,
            updatedBy:       msg.sender,
            auditorApproved: false,
            source:          source
        });

        emit PriceUpdatedDirect(token, price, dataHash, msg.sender, source);
    }

    function submitPrice(
        address         token,
        uint256         price,
        bytes32         dataHash,
        string calldata source
    ) external onlyRole(ORACLE_UPDATER_ROLE) whenNotPaused {
        require(token != address(0), "Zero address");
        require(price > 0,           "Price must be > 0");

        pendingPrices[token] = PendingPrice({
            price:       price,
            dataHash:    dataHash,
            source:      source,
            submittedAt: block.timestamp,
            submittedBy: msg.sender,
            exists:      true
        });

        uint256 subId = ++submissionIds[token];

        emit PriceSubmitted(token, price, dataHash, subId, msg.sender, source);
    }

    function approvePrice(address token)
        external onlyRole(AUDITOR_ROLE)
    {
        PendingPrice storage p = pendingPrices[token];
        require(p.exists, "No pending price");

        prices[token] = PriceData({
            price:           p.price,
            timestamp:       block.timestamp,
            dataHash:        p.dataHash,
            submissionId:    submissionIds[token],
            updatedBy:       p.submittedBy,
            auditorApproved: true,
            source:          p.source
        });

        delete pendingPrices[token];
        emit PriceApproved(token, p.price, msg.sender);
    }

    function rejectPrice(address token, string calldata reason)
        external onlyRole(AUDITOR_ROLE)
    {
        require(pendingPrices[token].exists, "No pending price");
        delete pendingPrices[token];
        emit PriceRejected(token, reason, msg.sender);
    }

    // ─── VIEW FUNCTIONS ───────────────────────────────────────────

    function getPrice(address token)
        external view returns (uint256 price, uint256 timestamp)
    {
        PriceData storage p = prices[token];
        require(p.price > 0, "No price available");
        require(
            block.timestamp <= p.timestamp + priceValidityPeriod,
            "Price data is stale"
        );
        return (p.price, p.timestamp);
    }

    function getPriceRaw(address token)
        external view returns (PriceData memory)
    {
        return prices[token];
    }

    function isPriceFresh(address token) external view returns (bool) {
        PriceData storage p = prices[token];
        return p.price > 0
            && block.timestamp <= p.timestamp + priceValidityPeriod;
    }

    function hasPendingPrice(address token) external view returns (bool) {
        return pendingPrices[token].exists;
    }

    // ─── ADMIN ────────────────────────────────────────────────────

    function setRequireAuditorApproval(bool required)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        requireAuditorApproval = required;
        emit AuditorApprovalToggled(required);
    }

    function setPriceValidityPeriod(uint256 period)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(period >= 1 hours, "Too short");
        priceValidityPeriod = period;
        emit PriceValidityUpdated(period);
    }

    function pause()   external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
