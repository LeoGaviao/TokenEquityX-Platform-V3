// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./ComplianceRegistry.sol";

contract AssetToken is Initializable, ERC20Upgradeable, OwnableUpgradeable, UUPSUpgradeable {

    ComplianceRegistry public complianceRegistry;

    string  public assetSymbol;
    string  public assetName;
    string  public assetClass;
    string  public spvId;
    uint256 public totalTokenSupply;
    uint256 public referencePriceUSD;
    bool    public tradingEnabled;
    address public issuer;

    event TradingEnabled(uint256 timestamp);
    event TradingDisabled(uint256 timestamp);
    event ReferencePriceUpdated(uint256 newPrice, uint256 timestamp);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        address initialOwner,
        address _complianceRegistry,
        string memory _symbol,
        string memory _name,
        string memory _assetClass,
        string memory _spvId,
        uint256 _totalSupply,
        uint256 _referencePriceUSD,
        address _issuer
    ) public initializer {
        __ERC20_init(_name, _symbol);
        __Ownable_init(initialOwner);
        complianceRegistry = ComplianceRegistry(_complianceRegistry);
        assetSymbol        = _symbol;
        assetName          = _name;
        assetClass         = _assetClass;
        spvId              = _spvId;
        totalTokenSupply   = _totalSupply;
        referencePriceUSD  = _referencePriceUSD;
        tradingEnabled     = false;
        issuer             = _issuer;
        _mint(_issuer, _totalSupply);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            require(tradingEnabled, "Trading not enabled");
            require(complianceRegistry.isApproved(from), "Sender not KYC approved");
            require(complianceRegistry.isApproved(to),   "Recipient not KYC approved");
        }
        super._update(from, to, value);
    }

    function enableTrading() external onlyOwner {
        tradingEnabled = true;
        emit TradingEnabled(block.timestamp);
    }

    function disableTrading() external onlyOwner {
        tradingEnabled = false;
        emit TradingDisabled(block.timestamp);
    }

    function updateReferencePrice(uint256 newPriceCents) external onlyOwner {
        referencePriceUSD = newPriceCents;
        emit ReferencePriceUpdated(newPriceCents, block.timestamp);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
