// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract SPVRegistry is Initializable, OwnableUpgradeable, UUPSUpgradeable {

    struct SPV {
        string  spvId;
        string  companyName;
        string  registrationNo;
        string  assetClass;
        address tokenAddress;
        address issuerWallet;
        uint256 registeredAt;
        bool    active;
    }

    mapping(string => SPV)    private _spvs;
    mapping(address => string) private _tokenToSpv;
    string[]                  private _spvIds;

    event SPVRegistered(string indexed spvId, address tokenAddress, uint256 timestamp);
    event SPVDeactivated(string indexed spvId, uint256 timestamp);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
    }

    function registerSPV(
        string calldata spvId,
        string calldata companyName,
        string calldata registrationNo,
        string calldata assetClass,
        address tokenAddress,
        address issuerWallet
    ) external onlyOwner {
        require(bytes(spvId).length > 0, "Empty SPV ID");
        require(tokenAddress != address(0), "Zero token address");
        require(!_spvs[spvId].active, "SPV already registered");
        _spvs[spvId] = SPV({
            spvId:          spvId,
            companyName:    companyName,
            registrationNo: registrationNo,
            assetClass:     assetClass,
            tokenAddress:   tokenAddress,
            issuerWallet:   issuerWallet,
            registeredAt:   block.timestamp,
            active:         true
        });
        _tokenToSpv[tokenAddress] = spvId;
        _spvIds.push(spvId);
        emit SPVRegistered(spvId, tokenAddress, block.timestamp);
    }

    function deactivateSPV(string calldata spvId) external onlyOwner {
        _spvs[spvId].active = false;
        emit SPVDeactivated(spvId, block.timestamp);
    }

    function getSPV(string calldata spvId) external view returns (SPV memory) {
        return _spvs[spvId];
    }

    function getSpvByToken(address tokenAddress) external view returns (SPV memory) {
        return _spvs[_tokenToSpv[tokenAddress]];
    }

    function getAllSpvIds() external view returns (string[] memory) {
        return _spvIds;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
