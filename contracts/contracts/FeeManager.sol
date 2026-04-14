// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract FeeManager is Initializable, OwnableUpgradeable, UUPSUpgradeable {

    uint256 public constant SECZ_LEVY_BPS    = 32;
    uint256 public constant PLATFORM_FEE_BPS = 50;
    uint256 public constant ISSUANCE_FEE_BPS = 200;
    uint256 public constant BPS_DENOMINATOR  = 10000;

    address public seczTreasury;
    address public platformTreasury;

    struct FeeRecord {
        string  feeType;
        string  symbol;
        uint256 tradeValue;
        uint256 feeAmount;
        uint256 timestamp;
        address payer;
    }

    FeeRecord[] private _feeHistory;
    uint256 public totalSeczLevyCollected;
    uint256 public totalPlatformFeesCollected;
    uint256 public totalIssuanceFeesCollected;

    mapping(address => bool) private _authorisedCallers;

    event FeeCollected(string feeType, string symbol, uint256 feeAmount, address payer, uint256 timestamp);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        address initialOwner,
        address _seczTreasury,
        address _platformTreasury
    ) public initializer {
        __Ownable_init(initialOwner);
        seczTreasury     = _seczTreasury;
        platformTreasury = _platformTreasury;
        _authorisedCallers[initialOwner] = true;
    }

    modifier onlyAuthorised() {
        require(_authorisedCallers[msg.sender] || msg.sender == owner(), "Not authorised");
        _;
    }

    function authoriseCaller(address caller) external onlyOwner {
        _authorisedCallers[caller] = true;
    }

    function recordSeczLevy(
        string calldata symbol,
        uint256 tradeValueCents,
        address payer
    ) external onlyAuthorised returns (uint256 levyAmount) {
        levyAmount = (tradeValueCents * SECZ_LEVY_BPS) / BPS_DENOMINATOR;
        _feeHistory.push(FeeRecord({
            feeType:    "SECZ_LEVY",
            symbol:     symbol,
            tradeValue: tradeValueCents,
            feeAmount:  levyAmount,
            timestamp:  block.timestamp,
            payer:      payer
        }));
        totalSeczLevyCollected += levyAmount;
        emit FeeCollected("SECZ_LEVY", symbol, levyAmount, payer, block.timestamp);
    }

    function recordTradingFee(
        string calldata symbol,
        uint256 tradeValueCents,
        address payer
    ) external onlyAuthorised returns (uint256 feeAmount) {
        feeAmount = (tradeValueCents * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        _feeHistory.push(FeeRecord({
            feeType:    "PLATFORM_FEE",
            symbol:     symbol,
            tradeValue: tradeValueCents,
            feeAmount:  feeAmount,
            timestamp:  block.timestamp,
            payer:      payer
        }));
        totalPlatformFeesCollected += feeAmount;
        emit FeeCollected("PLATFORM_FEE", symbol, feeAmount, payer, block.timestamp);
    }

    function recordIssuanceFee(
        string calldata symbol,
        uint256 capitalRaisedCents,
        address payer
    ) external onlyAuthorised returns (uint256 feeAmount) {
        feeAmount = (capitalRaisedCents * ISSUANCE_FEE_BPS) / BPS_DENOMINATOR;
        _feeHistory.push(FeeRecord({
            feeType:    "ISSUANCE_FEE",
            symbol:     symbol,
            tradeValue: capitalRaisedCents,
            feeAmount:  feeAmount,
            timestamp:  block.timestamp,
            payer:      payer
        }));
        totalIssuanceFeesCollected += feeAmount;
        emit FeeCollected("ISSUANCE_FEE", symbol, feeAmount, payer, block.timestamp);
    }

    function getFeeHistory() external view returns (FeeRecord[] memory) {
        return _feeHistory;
    }

    function getFeeHistoryLength() external view returns (uint256) {
        return _feeHistory.length;
    }

    function updateSeczTreasury(address newTreasury) external onlyOwner {
        seczTreasury = newTreasury;
    }

    function updatePlatformTreasury(address newTreasury) external onlyOwner {
        platformTreasury = newTreasury;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
