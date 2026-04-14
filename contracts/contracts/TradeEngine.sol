// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./ComplianceRegistry.sol";
import "./FeeManager.sol";

contract TradeEngine is Initializable, OwnableUpgradeable, UUPSUpgradeable {

    ComplianceRegistry public complianceRegistry;
    FeeManager         public feeManager;

    uint256 private _status;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED     = 2;

    modifier nonReentrant() {
        require(_status != _ENTERED, "Reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    struct Trade {
        string  tradeId;
        string  symbol;
        address buyer;
        address seller;
        uint256 quantity;
        uint256 priceCents;
        uint256 totalValueCents;
        uint256 seczLevyCents;
        uint256 platformFeeCents;
        uint256 settledAt;
        bool    settled;
    }

    mapping(string => Trade) private _trades;
    string[]                 private _tradeIds;
    mapping(address => bool) private _authorisedCallers;

    event TradeSettled(
        string indexed tradeId,
        string symbol,
        address buyer,
        address seller,
        uint256 quantity,
        uint256 priceCents,
        uint256 totalValueCents,
        uint256 timestamp
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        address initialOwner,
        address _complianceRegistry,
        address _feeManager
    ) public initializer {
        __Ownable_init(initialOwner);
        complianceRegistry = ComplianceRegistry(_complianceRegistry);
        feeManager         = FeeManager(_feeManager);
        _authorisedCallers[initialOwner] = true;
        _status = _NOT_ENTERED;
    }

    modifier onlyAuthorised() {
        require(_authorisedCallers[msg.sender] || msg.sender == owner(), "Not authorised");
        _;
    }

    function authoriseCaller(address caller) external onlyOwner {
        _authorisedCallers[caller] = true;
    }

    function settleTrade(
        string calldata tradeId,
        string calldata symbol,
        address buyer,
        address seller,
        uint256 quantity,
        uint256 priceCents
    ) external onlyAuthorised nonReentrant {
        require(bytes(_trades[tradeId].tradeId).length == 0, "Trade already recorded");
        require(complianceRegistry.isApproved(buyer),  "Buyer not KYC approved");
        require(complianceRegistry.isApproved(seller), "Seller not KYC approved");
        require(quantity > 0,   "Zero quantity");
        require(priceCents > 0, "Zero price");

        uint256 totalValue  = quantity * priceCents;
        uint256 seczLevy    = feeManager.recordSeczLevy(symbol, totalValue, buyer);
        uint256 platformFee = feeManager.recordTradingFee(symbol, totalValue, buyer);

        _trades[tradeId] = Trade({
            tradeId:          tradeId,
            symbol:           symbol,
            buyer:            buyer,
            seller:           seller,
            quantity:         quantity,
            priceCents:       priceCents,
            totalValueCents:  totalValue,
            seczLevyCents:    seczLevy,
            platformFeeCents: platformFee,
            settledAt:        block.timestamp,
            settled:          true
        });
        _tradeIds.push(tradeId);

        emit TradeSettled(tradeId, symbol, buyer, seller, quantity, priceCents, totalValue, block.timestamp);
    }

    function getTrade(string calldata tradeId) external view returns (Trade memory) {
        return _trades[tradeId];
    }

    function getTradeCount() external view returns (uint256) {
        return _tradeIds.length;
    }

    function getRecentTradeIds(uint256 count) external view returns (string[] memory) {
        uint256 total  = _tradeIds.length;
        uint256 start  = total > count ? total - count : 0;
        uint256 length = total - start;
        string[] memory result = new string[](length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = _tradeIds[start + i];
        }
        return result;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
