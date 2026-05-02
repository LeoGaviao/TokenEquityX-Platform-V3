const router = require('express').Router();
const { authenticate } = require('../middleware/auth');

router.post('/paynow/initiate', authenticate, async (req, res) => {
  const { amount, method } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });
  const PAYNOW_ID  = process.env.PAYNOW_INTEGRATION_ID  || '';
  const PAYNOW_KEY = process.env.PAYNOW_INTEGRATION_KEY || '';
  if (!PAYNOW_ID || !PAYNOW_KEY) {
    return res.status(503).json({ error: 'Paynow not configured yet. Please use bank transfer.', placeholder: true });
  }
  res.json({ success: false, message: 'Paynow integration coming soon.', placeholder: true });
});

router.post('/paynow/callback', async (req, res) => {
  console.log('[PAYNOW CALLBACK]', req.body);
  res.send('OK');
});

router.post('/stripe/create-intent', authenticate, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });
  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
  if (!STRIPE_KEY) {
    return res.status(503).json({ error: 'Stripe not configured yet. Please use bank transfer.', placeholder: true });
  }
  res.json({ success: false, message: 'Stripe integration coming soon.', placeholder: true });
});

router.post('/stripe/webhook', async (req, res) => {
  console.log('[STRIPE WEBHOOK]', req.body?.type);
  res.json({ received: true });
});

module.exports = router;
