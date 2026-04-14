// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract AuditLog is Initializable, OwnableUpgradeable, UUPSUpgradeable {

    struct LogEntry {
        uint256 entryId;
        string  action;
        string  entityId;
        string  details;
        address actor;
        uint256 timestamp;
    }

    LogEntry[] private _log;
    mapping(address => bool) private _authorisedLoggers;

    event EntryLogged(uint256 indexed entryId, string action, string entityId, address actor, uint256 timestamp);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        _authorisedLoggers[initialOwner] = true;
    }

    modifier onlyAuthorised() {
        require(_authorisedLoggers[msg.sender] || msg.sender == owner(), "Not authorised");
        _;
    }

    function authoriseLogger(address logger) external onlyOwner {
        _authorisedLoggers[logger] = true;
    }

    function log(
        string calldata action,
        string calldata entityId,
        string calldata details
    ) external onlyAuthorised {
        uint256 entryId = _log.length;
        _log.push(LogEntry({
            entryId:   entryId,
            action:    action,
            entityId:  entityId,
            details:   details,
            actor:     msg.sender,
            timestamp: block.timestamp
        }));
        emit EntryLogged(entryId, action, entityId, msg.sender, block.timestamp);
    }

    function getEntry(uint256 entryId) external view returns (LogEntry memory) {
        require(entryId < _log.length, "Entry does not exist");
        return _log[entryId];
    }

    function getEntriesCount() external view returns (uint256) {
        return _log.length;
    }

    function getRecentEntries(uint256 count) external view returns (LogEntry[] memory) {
        uint256 total  = _log.length;
        uint256 start  = total > count ? total - count : 0;
        uint256 length = total - start;
        LogEntry[] memory result = new LogEntry[](length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = _log[start + i];
        }
        return result;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
