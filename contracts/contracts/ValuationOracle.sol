// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract ValuationOracle is Initializable, OwnableUpgradeable, UUPSUpgradeable {

    struct PriceRecord {
        uint256 priceCents;
        uint256 timestamp;
        string  methodology;
        uint256 revenueMultiple;
        uint256 dcfValue;
    }

    mapping(string => PriceRecord)   private _latestPrice;
    mapping(string => PriceRecord[]) private _priceHistory;
    mapping(address => bool)         private _authorisedUpdaters;

    event PriceUpdated(string indexed symbol, uint256 priceCents, uint256 timestamp);
    event UpdaterAuthorised(address indexed updater);
    event UpdaterRevoked(address indexed updater);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        _authorisedUpdaters[initialOwner] = true;
    }

    modifier onlyAuthorised() {
        require(_authorisedUpdaters[msg.sender] || msg.sender == owner(), "Not authorised");
        _;
    }

    function authoriseUpdater(address updater) external onlyOwner {
        _authorisedUpdaters[updater] = true;
        emit UpdaterAuthorised(updater);
    }

    function revokeUpdater(address updater) external onlyOwner {
        _authorisedUpdaters[updater] = false;
        emit UpdaterRevoked(updater);
    }

    function updatePrice(
        string calldata symbol,
        uint256 priceCents,
        string calldata methodology,
        uint256 revenueMultiple,
        uint256 dcfValue
    ) external onlyAuthorised {
        require(priceCents >= 100, "Minimum price is $1.00");
        PriceRecord memory record = PriceRecord({
            priceCents:      priceCents,
            timestamp:       block.timestamp,
            methodology:     methodology,
            revenueMultiple: revenueMultiple,
            dcfValue:        dcfValue
        });
        _latestPrice[symbol] = record;
        _priceHistory[symbol].push(record);
        emit PriceUpdated(symbol, priceCents, block.timestamp);
    }

    function getLatestPrice(string calldata symbol) external view returns (PriceRecord memory) {
        return _latestPrice[symbol];
    }

    function getPriceHistory(string calldata symbol) external view returns (PriceRecord[] memory) {
        return _priceHistory[symbol];
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
