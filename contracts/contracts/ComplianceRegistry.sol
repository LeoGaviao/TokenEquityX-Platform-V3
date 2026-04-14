// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract ComplianceRegistry is Initializable, OwnableUpgradeable, UUPSUpgradeable {

    mapping(address => bool)    private _approved;
    mapping(address => uint256) private _approvedAt;

    event WalletApproved(address indexed wallet, uint256 timestamp);
    event WalletRevoked(address indexed wallet, uint256 timestamp);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
    }

    function approveWallet(address wallet) external onlyOwner {
        require(wallet != address(0), "Zero address");
        _approved[wallet]   = true;
        _approvedAt[wallet] = block.timestamp;
        emit WalletApproved(wallet, block.timestamp);
    }

    function approveWallets(address[] calldata wallets) external onlyOwner {
        for (uint256 i = 0; i < wallets.length; i++) {
            require(wallets[i] != address(0), "Zero address");
            _approved[wallets[i]]   = true;
            _approvedAt[wallets[i]] = block.timestamp;
            emit WalletApproved(wallets[i], block.timestamp);
        }
    }

    function revokeWallet(address wallet) external onlyOwner {
        _approved[wallet] = false;
        emit WalletRevoked(wallet, block.timestamp);
    }

    function isApproved(address wallet) external view returns (bool) {
        return _approved[wallet];
    }

    function approvedAt(address wallet) external view returns (uint256) {
        return _approvedAt[wallet];
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
