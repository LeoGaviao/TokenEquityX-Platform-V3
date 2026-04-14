// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract DistributionManager is Initializable, OwnableUpgradeable, UUPSUpgradeable {

    uint256 public constant DIVIDEND_WITHHOLDING_BPS = 1000;
    uint256 public constant INTEREST_WITHHOLDING_BPS = 1500;
    uint256 public constant BPS_DENOMINATOR          = 10000;

    enum DistributionType { DIVIDEND, INTEREST, RENTAL, ROYALTY }

    struct Distribution {
        string           distributionId;
        string           symbol;
        DistributionType distType;
        uint256          grossAmountCents;
        uint256          withholdingTaxCents;
        uint256          netAmountCents;
        uint256          perTokenCents;
        uint256          totalTokenSupply;
        uint256          createdAt;
        uint256          paidAt;
        bool             paid;
        string           period;
    }

    mapping(string => Distribution)              private _distributions;
    string[]                                     private _distributionIds;
    mapping(address => mapping(string => bool))  private _claimed;

    event DistributionCreated(string indexed distributionId, string symbol, uint256 netAmountCents, uint256 timestamp);
    event DistributionPaid(string indexed distributionId, uint256 timestamp);
    event DistributionClaimed(string indexed distributionId, address indexed wallet, uint256 amountCents);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
    }

    function createDistribution(
        string calldata distributionId,
        string calldata symbol,
        DistributionType distType,
        uint256 grossAmountCents,
        uint256 totalTokenSupply,
        string calldata period
    ) external onlyOwner returns (uint256 netAmount) {
        require(bytes(_distributions[distributionId].distributionId).length == 0, "Already exists");
        require(grossAmountCents > 0, "Zero amount");
        require(totalTokenSupply > 0, "Zero supply");

        uint256 withholdingBps = distType == DistributionType.INTEREST
            ? INTEREST_WITHHOLDING_BPS
            : DIVIDEND_WITHHOLDING_BPS;

        uint256 withholdingTax = (grossAmountCents * withholdingBps) / BPS_DENOMINATOR;
        netAmount = grossAmountCents - withholdingTax;
        uint256 perToken = netAmount / totalTokenSupply;

        _distributions[distributionId] = Distribution({
            distributionId:      distributionId,
            symbol:              symbol,
            distType:            distType,
            grossAmountCents:    grossAmountCents,
            withholdingTaxCents: withholdingTax,
            netAmountCents:      netAmount,
            perTokenCents:       perToken,
            totalTokenSupply:    totalTokenSupply,
            createdAt:           block.timestamp,
            paidAt:              0,
            paid:                false,
            period:              period
        });
        _distributionIds.push(distributionId);
        emit DistributionCreated(distributionId, symbol, netAmount, block.timestamp);
    }

    function markPaid(string calldata distributionId) external onlyOwner {
        _distributions[distributionId].paid   = true;
        _distributions[distributionId].paidAt = block.timestamp;
        emit DistributionPaid(distributionId, block.timestamp);
    }

    function recordClaim(string calldata distributionId, address wallet, uint256 tokenBalance) external onlyOwner {
        require(!_claimed[wallet][distributionId], "Already claimed");
        Distribution memory d = _distributions[distributionId];
        require(d.paid, "Not yet paid");
        uint256 claimAmount = tokenBalance * d.perTokenCents;
        _claimed[wallet][distributionId] = true;
        emit DistributionClaimed(distributionId, wallet, claimAmount);
    }

    function hasClaimed(address wallet, string calldata distributionId) external view returns (bool) {
        return _claimed[wallet][distributionId];
    }

    function getDistribution(string calldata distributionId) external view returns (Distribution memory) {
        return _distributions[distributionId];
    }

    function getAllDistributionIds() external view returns (string[] memory) {
        return _distributionIds;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
