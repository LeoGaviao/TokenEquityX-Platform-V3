// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./ComplianceRegistry.sol";

contract KYCManager is Initializable, OwnableUpgradeable, UUPSUpgradeable {

    ComplianceRegistry public complianceRegistry;

    enum KYCStatus { NONE, PENDING, APPROVED, REJECTED, REVOKED }

    struct KYCRecord {
        KYCStatus status;
        string    investorType;
        uint256   approvedAt;
        uint256   expiresAt;
        string    jurisdiction;
    }

    mapping(address => KYCRecord) private _records;

    event KYCApproved(address indexed wallet, string investorType, uint256 expiresAt);
    event KYCRevoked(address indexed wallet, string reason);
    event KYCRejected(address indexed wallet);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address initialOwner, address _complianceRegistry) public initializer {
        __Ownable_init(initialOwner);
        complianceRegistry = ComplianceRegistry(_complianceRegistry);
    }

    function approveKYC(
        address wallet,
        string calldata investorType,
        string calldata jurisdiction,
        uint256 validityDays
    ) external onlyOwner {
        uint256 expiresAt = block.timestamp + (validityDays * 1 days);
        _records[wallet] = KYCRecord({
            status:       KYCStatus.APPROVED,
            investorType: investorType,
            approvedAt:   block.timestamp,
            expiresAt:    expiresAt,
            jurisdiction: jurisdiction
        });
        complianceRegistry.approveWallet(wallet);
        emit KYCApproved(wallet, investorType, expiresAt);
    }

    function revokeKYC(address wallet, string calldata reason) external onlyOwner {
        _records[wallet].status = KYCStatus.REVOKED;
        complianceRegistry.revokeWallet(wallet);
        emit KYCRevoked(wallet, reason);
    }

    function rejectKYC(address wallet) external onlyOwner {
        _records[wallet].status = KYCStatus.REJECTED;
        emit KYCRejected(wallet);
    }

    function getKYCRecord(address wallet) external view returns (KYCRecord memory) {
        return _records[wallet];
    }

    function isKYCValid(address wallet) external view returns (bool) {
        KYCRecord memory r = _records[wallet];
        return r.status == KYCStatus.APPROVED && block.timestamp <= r.expiresAt;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
