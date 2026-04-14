// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract GovernanceContract is Initializable, OwnableUpgradeable, UUPSUpgradeable {

    enum ProposalStatus { ACTIVE, PASSED, REJECTED, CANCELLED }
    enum VoteChoice     { FOR, AGAINST, ABSTAIN }

    struct Proposal {
        string         proposalId;
        string         symbol;
        string         title;
        string         description;
        uint256        startTime;
        uint256        endTime;
        uint256        votesFor;
        uint256        votesAgainst;
        uint256        votesAbstain;
        ProposalStatus status;
        address        proposer;
    }

    mapping(string => Proposal)                    private _proposals;
    mapping(string => mapping(address => bool))    private _hasVoted;
    mapping(string => mapping(address => uint256)) private _voteWeight;
    string[] private _proposalIds;

    event ProposalCreated(string indexed proposalId, string symbol, string title, uint256 endTime);
    event VoteCast(string indexed proposalId, address indexed voter, VoteChoice choice, uint256 weight);
    event ProposalFinalized(string indexed proposalId, ProposalStatus status);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
    }

    function createProposal(
        string calldata proposalId,
        string calldata symbol,
        string calldata title,
        string calldata description,
        uint256 durationDays
    ) external onlyOwner {
        require(bytes(_proposals[proposalId].proposalId).length == 0, "Already exists");
        require(durationDays > 0, "Zero duration");
        _proposals[proposalId] = Proposal({
            proposalId:   proposalId,
            symbol:       symbol,
            title:        title,
            description:  description,
            startTime:    block.timestamp,
            endTime:      block.timestamp + (durationDays * 1 days),
            votesFor:     0,
            votesAgainst: 0,
            votesAbstain: 0,
            status:       ProposalStatus.ACTIVE,
            proposer:     msg.sender
        });
        _proposalIds.push(proposalId);
        emit ProposalCreated(proposalId, symbol, title, block.timestamp + (durationDays * 1 days));
    }

    function castVote(
        string calldata proposalId,
        address voter,
        VoteChoice choice,
        uint256 tokenBalance
    ) external onlyOwner {
        Proposal storage p = _proposals[proposalId];
        require(p.status == ProposalStatus.ACTIVE, "Not active");
        require(block.timestamp <= p.endTime, "Voting ended");
        require(!_hasVoted[proposalId][voter], "Already voted");
        require(tokenBalance > 0, "No tokens");

        _hasVoted[proposalId][voter]   = true;
        _voteWeight[proposalId][voter] = tokenBalance;

        if (choice == VoteChoice.FOR)          p.votesFor      += tokenBalance;
        else if (choice == VoteChoice.AGAINST) p.votesAgainst  += tokenBalance;
        else                                   p.votesAbstain  += tokenBalance;

        emit VoteCast(proposalId, voter, choice, tokenBalance);
    }

    function finalizeProposal(string calldata proposalId) external onlyOwner {
        Proposal storage p = _proposals[proposalId];
        require(p.status == ProposalStatus.ACTIVE, "Not active");
        require(block.timestamp > p.endTime, "Voting still open");
        p.status = p.votesFor > p.votesAgainst
            ? ProposalStatus.PASSED
            : ProposalStatus.REJECTED;
        emit ProposalFinalized(proposalId, p.status);
    }

    function getProposal(string calldata proposalId) external view returns (Proposal memory) {
        return _proposals[proposalId];
    }

    function hasVoted(string calldata proposalId, address voter) external view returns (bool) {
        return _hasVoted[proposalId][voter];
    }

    function getAllProposalIds() external view returns (string[] memory) {
        return _proposalIds;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
