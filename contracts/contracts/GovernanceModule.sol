// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./AssetToken.sol";

/**
 * @title GovernanceModule
 * @notice On-chain governance for TokenEquityX V2.
 *         Supports AGMs, EGMs, and board resolutions.
 *         Token-weighted voting with snapshot balances.
 *         Supports ordinary (50%+) and special (75%+) resolutions.
 *         IPFS document storage for supporting materials.
 */
contract GovernanceModule is AccessControl, Pausable {

    // ─── ROLES ────────────────────────────────────────────────────
    bytes32 public constant PROPOSER_ROLE  = keccak256("PROPOSER_ROLE");
    bytes32 public constant AUDITOR_ROLE   = keccak256("AUDITOR_ROLE");

    // ─── ENUMS ────────────────────────────────────────────────────
    enum ResolutionType {
        ORDINARY,   // requires > 50% of votes cast
        SPECIAL,    // requires > 75% of votes cast
        BOARD       // board resolution — no quorum required
    }

    enum ProposalStatus {
        ACTIVE,
        PASSED,
        REJECTED,
        CANCELLED,
        EXECUTED
    }

    // ─── STRUCTS ──────────────────────────────────────────────────
    struct Proposal {
        uint256        id;
        address        token;
        string         title;
        string         description;
        string         ipfsDocHash;      // supporting documents on IPFS
        ResolutionType resType;
        ProposalStatus status;
        uint256        snapshotBlock;
        uint256        startTime;
        uint256        endTime;
        uint256        votesFor;
        uint256        votesAgainst;
        uint256        votesAbstain;
        uint256        totalEligible;    // total supply at snapshot
        address        proposer;
        bool           executed;
    }

    // ─── STATE ────────────────────────────────────────────────────
    uint256 public proposalCount;
    uint256 public minVotingPeriod  = 2  days;
    uint256 public maxVotingPeriod  = 30 days;
    uint256 public quorumBps        = 1000;  // 10% of supply must vote

    mapping(uint256 => Proposal)                          public proposals;
    mapping(uint256 => mapping(address => bool))          public hasVoted;
    mapping(uint256 => mapping(address => uint8))         public voteChoice;
    mapping(uint256 => mapping(address => uint256))       public voteWeight;
    mapping(address => uint256[])                         public tokenProposals;

    // ─── EVENTS ───────────────────────────────────────────────────
    event ProposalCreated(
        uint256 indexed id,
        address indexed token,
        address         proposer,
        string          title,
        ResolutionType  resType,
        uint256         endTime
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        uint8           choice,
        uint256         weight
    );
    event ProposalFinalized(
        uint256 indexed id,
        ProposalStatus  result,
        uint256         votesFor,
        uint256         votesAgainst
    );
    event ProposalCancelled(uint256 indexed id, string reason);
    event ProposalExecuted(uint256 indexed id);

    // ─── CONSTRUCTOR ──────────────────────────────────────────────
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PROPOSER_ROLE,      msg.sender);
        _grantRole(AUDITOR_ROLE,       msg.sender);
    }

    // ─── CREATE PROPOSAL ──────────────────────────────────────────

    /**
     * @notice Create a governance proposal for token holders to vote on.
     * @param token          The AssetToken address
     * @param title          Short title of the proposal
     * @param description    Full description
     * @param ipfsDocHash    IPFS hash of supporting documents
     * @param resType        ORDINARY, SPECIAL, or BOARD
     * @param votingDuration Duration in seconds
     */
    function createProposal(
        address        token,
        string calldata title,
        string calldata description,
        string calldata ipfsDocHash,
        ResolutionType  resType,
        uint256         votingDuration
    ) external onlyRole(PROPOSER_ROLE) whenNotPaused returns (uint256) {
        require(token != address(0),                   "Invalid token");
        require(bytes(title).length > 0,               "Empty title");
        require(votingDuration >= minVotingPeriod,     "Too short");
        require(votingDuration <= maxVotingPeriod,     "Too long");

        uint256 supply = AssetToken(token).totalSupply();
        require(supply > 0, "No tokens issued yet");

        proposalCount++;
        uint256 id = proposalCount;

        proposals[id] = Proposal({
            id:            id,
            token:         token,
            title:         title,
            description:   description,
            ipfsDocHash:   ipfsDocHash,
            resType:       resType,
            status:        ProposalStatus.ACTIVE,
            snapshotBlock: block.number,
            startTime:     block.timestamp,
            endTime:       block.timestamp + votingDuration,
            votesFor:      0,
            votesAgainst:  0,
            votesAbstain:  0,
            totalEligible: supply,
            proposer:      msg.sender,
            executed:      false
        });

        tokenProposals[token].push(id);

        emit ProposalCreated(
            id, token, msg.sender, title, resType,
            block.timestamp + votingDuration
        );

        return id;
    }

    // ─── CAST VOTE ────────────────────────────────────────────────

    /**
     * @notice Cast a vote on an active proposal.
     * @param proposalId The proposal ID
     * @param choice     1 = FOR, 2 = AGAINST, 3 = ABSTAIN
     */
    function castVote(uint256 proposalId, uint8 choice)
        external whenNotPaused
    {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.ACTIVE,               "Not active");
        require(block.timestamp >= p.startTime,                  "Not started");
        require(block.timestamp <= p.endTime,                    "Voting ended");
        require(!hasVoted[proposalId][msg.sender],               "Already voted");
        require(choice >= 1 && choice <= 3,                      "Invalid choice");

        uint256 weight = AssetToken(p.token).balanceOf(msg.sender);
        require(weight > 0, "No voting power");

        hasVoted[proposalId][msg.sender]  = true;
        voteChoice[proposalId][msg.sender] = choice;
        voteWeight[proposalId][msg.sender] = weight;

        if      (choice == 1) p.votesFor     += weight;
        else if (choice == 2) p.votesAgainst += weight;
        else                  p.votesAbstain  += weight;

        emit VoteCast(proposalId, msg.sender, choice, weight);
    }

    // ─── FINALIZE PROPOSAL ────────────────────────────────────────

    /**
     * @notice Finalize a proposal after voting period ends.
     *         Anyone can call this once the voting period is over.
     */
    function finalizeProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.ACTIVE, "Not active");
        require(block.timestamp > p.endTime,       "Voting still open");

        uint256 totalVotes = p.votesFor + p.votesAgainst + p.votesAbstain;
        uint256 quorum     = (p.totalEligible * quorumBps) / 10000;

        if (totalVotes < quorum) {
            // Quorum not met — rejected
            p.status = ProposalStatus.REJECTED;
        } else if (p.resType == ResolutionType.BOARD) {
            // Board resolutions pass automatically if quorum met
            p.status = ProposalStatus.PASSED;
        } else {
            uint256 forAndAgainst = p.votesFor + p.votesAgainst;
            if (forAndAgainst == 0) {
                p.status = ProposalStatus.REJECTED;
            } else {
                uint256 threshold = p.resType == ResolutionType.SPECIAL
                    ? 7500  // 75%
                    : 5001; // >50%
                uint256 forBps = (p.votesFor * 10000) / forAndAgainst;
                p.status = forBps >= threshold
                    ? ProposalStatus.PASSED
                    : ProposalStatus.REJECTED;
            }
        }

        emit ProposalFinalized(
            proposalId, p.status, p.votesFor, p.votesAgainst
        );
    }

    // ─── CANCEL PROPOSAL ─────────────────────────────────────────

    function cancelProposal(uint256 proposalId, string calldata reason)
        external onlyRole(PROPOSER_ROLE)
    {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.ACTIVE, "Not active");
        p.status = ProposalStatus.CANCELLED;
        emit ProposalCancelled(proposalId, reason);
    }

    // ─── VIEW FUNCTIONS ───────────────────────────────────────────

    function getProposal(uint256 id)
        external view returns (Proposal memory)
    {
        return proposals[id];
    }

    function getTokenProposals(address token)
        external view returns (uint256[] memory)
    {
        return tokenProposals[token];
    }

    function getActiveProposals(address token)
        external view returns (uint256[] memory)
    {
        uint256[] storage ids = tokenProposals[token];
        uint256 count = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (proposals[ids[i]].status == ProposalStatus.ACTIVE) count++;
        }
        uint256[] memory active = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (proposals[ids[i]].status == ProposalStatus.ACTIVE) {
                active[idx++] = ids[i];
            }
        }
        return active;
    }

    function getVoteSummary(uint256 proposalId)
        external view returns (
            uint256 votesFor,
            uint256 votesAgainst,
            uint256 votesAbstain,
            uint256 totalVotes,
            uint256 forPct,
            uint256 againstPct
        )
    {
        Proposal storage p = proposals[proposalId];
        votesFor     = p.votesFor;
        votesAgainst = p.votesAgainst;
        votesAbstain = p.votesAbstain;
        totalVotes   = votesFor + votesAgainst + votesAbstain;
        uint256 forAndAgainst = votesFor + votesAgainst;
        forPct     = forAndAgainst > 0 ? (votesFor     * 10000) / forAndAgainst : 0;
        againstPct = forAndAgainst > 0 ? (votesAgainst * 10000) / forAndAgainst : 0;
    }

    // ─── ADMIN ────────────────────────────────────────────────────

    function setQuorumBps(uint256 bps)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(bps <= 5000, "Max 50% quorum");
        quorumBps = bps;
    }

    function setVotingPeriodLimits(uint256 min, uint256 max)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(min < max, "Min must be < max");
        minVotingPeriod = min;
        maxVotingPeriod = max;
    }

    function pause()   external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}