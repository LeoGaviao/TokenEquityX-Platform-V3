const router = require('express').Router();
const db     = require('../db/pool');
const logger = require('../utils/logger');
const { authenticate }        = require('../middleware/auth');
const { requireRole, requireKYC } = require('../middleware/roles');
const { v4: uuidv4 }          = require('uuid');

// POST /api/governance/proposals — create a proposal
router.post('/proposals', authenticate, requireKYC, async (req, res) => {
  const {
    tokenSymbol, title, description,
    ipfsDocHash, resolutionType, votingDays
  } = req.body;

  if (!tokenSymbol || !title) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [tokens] = await db.execute(
      'SELECT * FROM tokens WHERE token_symbol = ?',
      [tokenSymbol.toUpperCase()]
    );
    if (tokens.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    const days       = Number(votingDays) || 7;
    const startTime  = new Date();
    const endTime    = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const proposalId = uuidv4();

    await db.execute(`
      INSERT INTO proposals
        (id, token_id, title, description, ipfs_doc_hash,
         resolution_type, status, voting_duration,
         start_time, end_time, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?)
    `, [
      proposalId, tokens[0].id, title, description,
      ipfsDocHash, resolutionType || 'ORDINARY',
      days, startTime, endTime, req.user.userId
    ]);

    logger.info('Proposal created', { proposalId, tokenSymbol });

    res.json({
      success:    true,
      proposalId,
      title,
      endTime
    });
  } catch (err) {
    logger.error('Proposal creation failed', { error: err.message });
    res.status(500).json({ error: 'Failed to create proposal: ' + err.message });
  }
});

// GET /api/governance/proposals — get all proposals
router.get('/proposals', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT p.*, t.token_symbol, t.token_name,
             s.legal_name as company_name,
             u.wallet_address as proposer_wallet,
             (SELECT COUNT(*) FROM votes v WHERE v.proposal_id = p.id) as total_votes
      FROM proposals p
      JOIN tokens t  ON t.id = p.token_id
      JOIN spvs s    ON s.id = t.spv_id
      JOIN users u   ON u.id = p.created_by
      ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch proposals' });
  }
});

// GET /api/governance/proposals/:tokenSymbol — proposals for a token
router.get('/proposals/:tokenSymbol', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT p.*, u.wallet_address as proposer_wallet
      FROM proposals p
      JOIN tokens t ON t.id = p.token_id
      JOIN users u  ON u.id = p.created_by
      WHERE t.token_symbol = ?
      ORDER BY p.created_at DESC
    `, [req.params.tokenSymbol.toUpperCase()]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch proposals' });
  }
});

// POST /api/governance/vote — cast a vote
router.post('/vote', authenticate, requireKYC, async (req, res) => {
  const { proposalId, choice } = req.body;

  if (!proposalId || !choice) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!['FOR', 'AGAINST', 'ABSTAIN'].includes(choice)) {
    return res.status(400).json({ error: 'Invalid choice' });
  }

  try {
    const [proposals] = await db.execute(
      'SELECT * FROM proposals WHERE id = ?', [proposalId]
    );
    if (proposals.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    const proposal = proposals[0];

    if (proposal.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Proposal is not active' });
    }
    if (new Date() > new Date(proposal.end_time)) {
      return res.status(400).json({ error: 'Voting period has ended' });
    }

    const [existing] = await db.execute(
      'SELECT id FROM votes WHERE proposal_id = ? AND user_id = ?',
      [proposalId, req.user.userId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Already voted on this proposal' });
    }

    const voteId     = uuidv4();
    const voteWeight = 1;

    await db.execute(
      'INSERT INTO votes (id, proposal_id, user_id, choice, vote_weight) VALUES (?, ?, ?, ?, ?)',
      [voteId, proposalId, req.user.userId, choice, voteWeight]
    );

    const col = choice === 'FOR' ? 'votes_for'
              : choice === 'AGAINST' ? 'votes_against'
              : 'votes_abstain';

    await db.execute(
      `UPDATE proposals SET ${col} = ${col} + 1 WHERE id = ?`,
      [proposalId]
    );

    res.json({ success: true, voteId, choice });
  } catch (err) {
    logger.error('Vote failed', { error: err.message });
    res.status(500).json({ error: 'Failed to cast vote: ' + err.message });
  }
});

// PUT /api/governance/proposals/:id/finalize — finalize after voting ends
router.put('/proposals/:id/finalize', authenticate, async (req, res) => {
  try {
    const [proposals] = await db.execute(
      'SELECT * FROM proposals WHERE id = ?', [req.params.id]
    );
    if (proposals.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    const p = proposals[0];

    if (p.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Proposal is not active' });
    }
    if (new Date() <= new Date(p.end_time)) {
      return res.status(400).json({ error: 'Voting period still open' });
    }

    const totalVotes   = Number(p.votes_for) + Number(p.votes_against) + Number(p.votes_abstain);
    const forAndAgainst = Number(p.votes_for) + Number(p.votes_against);
    let result = 'REJECTED';

    if (totalVotes > 0 && forAndAgainst > 0) {
      const forPct    = (Number(p.votes_for) * 10000) / forAndAgainst;
      const threshold = p.resolution_type === 'SPECIAL' ? 7500 : 5001;
      if (forPct >= threshold) result = 'PASSED';
    }

    await db.execute(
      'UPDATE proposals SET status = ? WHERE id = ?',
      [result, req.params.id]
    );

    res.json({ success: true, result, totalVotes });
  } catch (err) {
    res.status(500).json({ error: 'Could not finalize proposal' });
  }
});

module.exports = router;