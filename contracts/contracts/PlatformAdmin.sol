// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract PlatformAdmin is Initializable, UUPSUpgradeable {

    address public founder1;
    address public founder2;

    enum ActionType {
        PAUSE_TRADING,
        RESUME_TRADING,
        UPGRADE_CONTRACT,
        UPDATE_SECZ_TREASURY,
        EMERGENCY_HALT,
        DELIST_TOKEN
    }

    struct PendingAction {
        ActionType actionType;
        address    targetContract;
        bytes      callData;
        string     description;
        bool       approvedByFounder1;
        bool       approvedByFounder2;
        bool       executed;
        uint256    createdAt;
        uint256    expiresAt;
    }

    mapping(uint256 => PendingAction) private _actions;
    uint256 public actionCount;
    uint256 public constant ACTION_EXPIRY = 7 days;

    event ActionProposed(uint256 indexed actionId, ActionType actionType, string description, address proposer);
    event ActionApproved(uint256 indexed actionId, address approver);
    event ActionExecuted(uint256 indexed actionId, uint256 timestamp);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _founder1, address _founder2) public initializer {
        require(_founder1 != address(0) && _founder2 != address(0), "Zero address");
        require(_founder1 != _founder2, "Same address");
        founder1    = _founder1;
        founder2    = _founder2;
        actionCount = 0;
    }

    modifier onlyFounder() {
        require(msg.sender == founder1 || msg.sender == founder2, "Not a founder");
        _;
    }

    function proposeAction(
        ActionType actionType,
        address targetContract,
        bytes calldata callData,
        string calldata description
    ) external onlyFounder returns (uint256 actionId) {
        actionId = actionCount++;
        _actions[actionId] = PendingAction({
            actionType:         actionType,
            targetContract:     targetContract,
            callData:           callData,
            description:        description,
            approvedByFounder1: msg.sender == founder1,
            approvedByFounder2: msg.sender == founder2,
            executed:           false,
            createdAt:          block.timestamp,
            expiresAt:          block.timestamp + ACTION_EXPIRY
        });
        emit ActionProposed(actionId, actionType, description, msg.sender);
    }

    function approveAction(uint256 actionId) external onlyFounder {
        PendingAction storage a = _actions[actionId];
        require(!a.executed, "Already executed");
        require(block.timestamp <= a.expiresAt, "Action expired");

        if (msg.sender == founder1) a.approvedByFounder1 = true;
        if (msg.sender == founder2) a.approvedByFounder2 = true;

        emit ActionApproved(actionId, msg.sender);

        if (a.approvedByFounder1 && a.approvedByFounder2) {
            a.executed = true;
            if (a.callData.length > 0 && a.targetContract != address(0)) {
                (bool success,) = a.targetContract.call(a.callData);
                require(success, "Execution failed");
            }
            emit ActionExecuted(actionId, block.timestamp);
        }
    }

    function getAction(uint256 actionId) external view returns (PendingAction memory) {
        return _actions[actionId];
    }

    function isFullyApproved(uint256 actionId) external view returns (bool) {
        PendingAction memory a = _actions[actionId];
        return a.approvedByFounder1 && a.approvedByFounder2;
    }

    function _authorizeUpgrade(address newImplementation) internal override {
        require(msg.sender == founder1 || msg.sender == founder2, "Not a founder");
    }
}
