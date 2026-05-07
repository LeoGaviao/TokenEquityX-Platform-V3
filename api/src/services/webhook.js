// Banking partner webhook service
// Pushes structured JSON notifications to the banking partner endpoint
// on key platform events: deposits, trades, distributions, WHT batches

const db = require('../db/pool');

const WEBHOOK_EVENTS = {
  DEPOSIT_RECEIVED:    'deposit.received',
  TRADE_SETTLED:       'trade.settled',
  DISTRIBUTION_QUEUED: 'distribution.queued',
  WHT_BATCH_READY:     'wht.batch_ready',
  DISBURSEMENT_QUEUED: 'disbursement.queued',
  RECONCILIATION_ALERT:'reconciliation.alert',
};

async function getWebhookUrl() {
  try {
    const [rows] = await db.execute(
      "SELECT value FROM platform_settings WHERE key = 'banking_partner_webhook_url'",
      []
    );
    return rows[0]?.value || null;
  } catch {
    return null;
  }
}

async function pushWebhook(event, payload) {
  const url = await getWebhookUrl();
  if (!url) {
    console.log(`[WEBHOOK] No banking partner URL configured. Event: ${event}`);
    return { skipped: true };
  }
  try {
    const body = JSON.stringify({
      event,
      platform: 'TokenEquityX',
      timestamp: new Date().toISOString(),
      data: payload,
    });

    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'X-Platform':    'TokenEquityX',
        'X-Event':       event,
        'X-Timestamp':   new Date().toISOString(),
      },
      body,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!res.ok) {
      console.error(`[WEBHOOK] Failed: ${event} → HTTP ${res.status}`);
      return { error: `HTTP ${res.status}` };
    }

    console.log(`[WEBHOOK] Sent: ${event} → ${res.status}`);
    return { success: true, status: res.status };
  } catch (err) {
    console.error(`[WEBHOOK] Error sending ${event}:`, err.message);
    return { error: err.message };
  }
}

// ── Specific event helpers ─────────────────────────────────────────────────

async function notifyDepositReceived({ investorId, investorEmail, amount, reference, currency = 'USD' }) {
  return pushWebhook(WEBHOOK_EVENTS.DEPOSIT_RECEIVED, {
    investor_id:    investorId,
    investor_email: investorEmail,
    amount_usd:     amount,
    currency,
    reference,
    requires_action: 'Verify bank credit and confirm in admin dashboard',
  });
}

async function notifyTradeSettled({ tradeId, tokenSymbol, investorId, sellerId, amount, fee, wht, netAmount }) {
  return pushWebhook(WEBHOOK_EVENTS.TRADE_SETTLED, {
    trade_id:     tradeId,
    token_symbol: tokenSymbol,
    investor_id:  investorId,
    seller_id:    sellerId,
    gross_amount: amount,
    platform_fee: fee,
    wht_withheld: wht,
    net_amount:   netAmount,
    settlement_date: new Date().toISOString().split('T')[0],
  });
}

async function notifyDisbursementQueued({ disbursementId, tokenSymbol, entityName, netAmount, bankName, accountNumber }) {
  return pushWebhook(WEBHOOK_EVENTS.DISBURSEMENT_QUEUED, {
    disbursement_id: disbursementId,
    token_symbol:    tokenSymbol,
    entity_name:     entityName,
    net_amount_usd:  netAmount,
    destination_bank: bankName,
    account_number:   accountNumber,
    requires_action:  'Process EFT/RTGS transfer to issuer account',
  });
}

async function notifyWhtBatchReady({ batchId, period, totalAmount, residentAmount, nonResidentAmount, transactionCount }) {
  return pushWebhook(WEBHOOK_EVENTS.WHT_BATCH_READY, {
    batch_id:            batchId,
    period,
    total_wht_usd:       totalAmount,
    resident_wht:        residentAmount,
    non_resident_wht:    nonResidentAmount,
    transaction_count:   transactionCount,
    requires_action:     'Remit WHT to ZIMRA and record reference in Banking Partner Portal',
  });
}

async function notifyReconciliationAlert({ variance, onChainBalance, ledgerTotal, status }) {
  return pushWebhook(WEBHOOK_EVENTS.RECONCILIATION_ALERT, {
    status,
    on_chain_balance: onChainBalance,
    ledger_total:     ledgerTotal,
    variance,
    requires_action:  status === 'CRITICAL' ? 'URGENT: Investigate USDC balance discrepancy immediately' : 'Review reconciliation variance',
  });
}

module.exports = {
  pushWebhook,
  notifyDepositReceived,
  notifyTradeSettled,
  notifyDisbursementQueued,
  notifyWhtBatchReady,
  notifyReconciliationAlert,
  WEBHOOK_EVENTS,
};
