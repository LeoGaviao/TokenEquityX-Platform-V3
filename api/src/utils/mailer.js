// api/src/utils/mailer.js
// Email service using Resend HTTP API
// Required env: RESEND_API_KEY, SMTP_FROM, ADMIN_EMAIL, PLATFORM_URL

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM     = process.env.SMTP_FROM    || 'TokenEquityX <notifications@tokenequityx.co.zw>';
const ADMIN    = process.env.ADMIN_EMAIL  || 'admin@tokenequityx.co.zw';
const PLATFORM = process.env.PLATFORM_URL || 'https://tokenequityx.co.zw';

function baseTemplate(title, body) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f4f4f5; margin:0; padding:20px; }
  .card { background:#ffffff; border-radius:12px; max-width:600px; margin:0 auto; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08); }
  .header { background:#1A3C5E; padding:28px 32px; }
  .header h1 { color:#C8972B; font-size:22px; margin:0; font-weight:800; }
  .header p  { color:#93c5fd; font-size:13px; margin:6px 0 0; }
  .body { padding:28px 32px; }
  .body p { color:#374151; font-size:15px; line-height:1.6; margin:0 0 16px; }
  .amount { font-size:28px; font-weight:800; color:#1A3C5E; margin:16px 0; }
  .detail-row { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f3f4f6; font-size:14px; }
  .detail-row span:first-child { color:#6b7280; }
  .detail-row span:last-child  { color:#111827; font-weight:600; }
  .btn { display:inline-block; background:#1A3C5E; color:#ffffff !important; text-decoration:none; padding:12px 28px; border-radius:8px; font-weight:700; font-size:14px; margin-top:20px; }
  .btn-gold { background:#C8972B; }
  .success { color:#16a34a; font-weight:700; }
  .warning { color:#d97706; font-weight:700; }
  .danger  { color:#dc2626; font-weight:700; }
  .footer  { background:#f9fafb; padding:16px 32px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #e5e7eb; }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>TokenEquityX</h1>
      <p>Africa's Digital Capital Market &middot; SECZ Innovation Hub Sandbox</p>
    </div>
    <div class="body">
      <h2 style="margin:0 0 20px;color:#111827;font-size:20px;">${title}</h2>
      ${body}
    </div>
    <div class="footer">
      TokenEquityX (Private) Limited &middot; Harare, Zimbabwe &middot; tokenequityx.co.zw<br/>
      This is an automated notification. Do not reply to this email.
    </div>
  </div>
</body>
</html>`;
}

async function send(to, subject, html) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[MAILER] RESEND_API_KEY not set. Would send "${subject}" to ${to}`);
    return { skipped: true };
  }
  try {
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      [to],
      subject,
      html,
    });
    if (error) {
      console.error(`[MAILER] Resend error for "${subject}" to ${to}:`, error);
      return { error };
    }
    console.log(`[MAILER] Sent "${subject}" to ${to} — ${data?.id}`);
    return data;
  } catch (err) {
    console.error(`[MAILER] Failed "${subject}" to ${to}:`, err.message);
    return { error: err.message };
  }
}

async function notifyAdminDepositSubmitted({ investorName, investorEmail, amount, reference, depositId }) {
  return send(ADMIN, `💰 New Deposit Request — $${amount} from ${investorName}`,
    baseTemplate('New Deposit Request', `
      <p>A new deposit request has been submitted and requires your confirmation.</p>
      <div class="amount">$${parseFloat(amount).toFixed(2)} USD</div>
      <div class="detail-row"><span>Investor</span><span>${investorName}</span></div>
      <div class="detail-row"><span>Email</span><span>${investorEmail}</span></div>
      <div class="detail-row"><span>Reference</span><span style="font-family:monospace">${reference}</span></div>
      <div class="detail-row"><span>Deposit ID</span><span style="font-family:monospace">${depositId}</span></div>
      <p style="margin-top:20px;">Please verify the transfer in your banking portal then confirm in the admin dashboard.</p>
      <a href="${PLATFORM}/admin" class="btn btn-gold">Go to Admin Dashboard &rarr;</a>
    `));
}

async function notifyInvestorDepositConfirmed({ investorEmail, investorName, amount, reference }) {
  return send(investorEmail, `✅ Deposit Confirmed — $${amount} credited to your wallet`,
    baseTemplate('Your Deposit Has Been Confirmed', `
      <p>Dear ${investorName},</p>
      <p>Your deposit has been verified and credited to your TokenEquityX wallet.</p>
      <div class="amount" style="color:#16a34a">$${parseFloat(amount).toFixed(2)} USD</div>
      <div class="detail-row"><span>Reference</span><span style="font-family:monospace">${reference}</span></div>
      <div class="detail-row"><span>Status</span><span class="success">✔ Confirmed</span></div>
      <a href="${PLATFORM}/investor" class="btn btn-gold">Go to Dashboard &rarr;</a>
    `));
}

async function notifyInvestorDepositRejected({ investorEmail, investorName, amount, reference, reason }) {
  return send(investorEmail, `⚠️ Deposit Reference Not Verified — Action Required`,
    baseTemplate('Deposit Could Not Be Verified', `
      <p>Dear ${investorName},</p>
      <p>We were unable to verify your deposit of $${parseFloat(amount).toFixed(2)} USD (ref: ${reference}).</p>
      ${reason ? `<div class="detail-row"><span>Reason</span><span>${reason}</span></div>` : ''}
      <a href="${PLATFORM}/investor" class="btn">Contact Support &rarr;</a>
    `));
}

async function notifyAdminWithdrawalSubmitted({ investorName, investorEmail, amount, bankName, accountName, accountNumber, withdrawalId }) {
  return send(ADMIN, `💸 New Withdrawal Request — $${amount} from ${investorName}`,
    baseTemplate('New Withdrawal Request', `
      <p>A withdrawal request requires processing.</p>
      <div class="amount">$${parseFloat(amount).toFixed(2)} USD</div>
      <div class="detail-row"><span>Investor</span><span>${investorName}</span></div>
      <div class="detail-row"><span>Bank</span><span>${bankName}</span></div>
      <div class="detail-row"><span>Account Name</span><span>${accountName}</span></div>
      <div class="detail-row"><span>Account Number</span><span style="font-family:monospace">${accountNumber}</span></div>
      <div class="detail-row"><span>Withdrawal ID</span><span style="font-family:monospace">${withdrawalId}</span></div>
      <a href="${PLATFORM}/admin" class="btn btn-gold">Go to Admin Dashboard &rarr;</a>
    `));
}

async function notifyInvestorWithdrawalProcessing({ investorEmail, investorName, amount, bankName, accountNumber }) {
  return send(investorEmail, `💸 Withdrawal Being Processed — $${amount}`,
    baseTemplate('Your Withdrawal Is Being Processed', `
      <p>Dear ${investorName},</p>
      <div class="amount" style="color:#d97706">$${parseFloat(amount).toFixed(2)} USD</div>
      <div class="detail-row"><span>Destination Bank</span><span>${bankName}</span></div>
      <div class="detail-row"><span>Account</span><span style="font-family:monospace">${accountNumber}</span></div>
      <p style="margin-top:16px;">EFT transfers typically arrive within 1-2 business days.</p>
    `));
}

async function notifyInvestorWithdrawalCompleted({ investorEmail, investorName, amount, bankName, accountNumber, txReference }) {
  return send(investorEmail, `✅ Withdrawal Completed — $${amount} sent to your bank`,
    baseTemplate('Your Withdrawal Has Been Sent', `
      <p>Dear ${investorName},</p>
      <div class="amount" style="color:#16a34a">$${parseFloat(amount).toFixed(2)} USD</div>
      <div class="detail-row"><span>Bank Reference</span><span style="font-family:monospace">${txReference}</span></div>
      <div class="detail-row"><span>Status</span><span class="success">✔ Completed</span></div>
      <a href="${PLATFORM}/investor" class="btn">View Wallet History &rarr;</a>
    `));
}

async function notifyInvestorWithdrawalRejected({ investorEmail, investorName, amount, reason }) {
  return send(investorEmail, `❌ Withdrawal Request Rejected`,
    baseTemplate('Withdrawal Could Not Be Processed', `
      <p>Dear ${investorName},</p>
      <div class="amount" style="color:#dc2626">$${parseFloat(amount).toFixed(2)} USD</div>
      ${reason ? `<div class="detail-row"><span>Reason</span><span>${reason}</span></div>` : ''}
      <p>Your wallet balance has been restored.</p>
    `));
}

async function notifyIssuerApplicationReceived({ issuerEmail, issuerName, tokenSymbol, entityName, referenceNumber, meetingDay }) {
  return send(issuerEmail, `📋 Application Received — ${entityName} (${tokenSymbol})`,
    baseTemplate('Application Received', `
      <p>Dear ${issuerName},</p>
      <p>Your tokenisation application for <strong>${entityName}</strong> (${tokenSymbol}) has been received.</p>
      <div class="detail-row"><span>Reference</span><span style="font-family:monospace">${referenceNumber}</span></div>
      <div class="detail-row"><span>Status</span><span class="warning">⏳ Under Review</span></div>
      <p>Applications are reviewed every <strong>${meetingDay || 'Tuesday'}</strong>.</p>
      <a href="${PLATFORM}/issuer" class="btn btn-gold">View Your Application &rarr;</a>
    `));
}

async function notifyIssuerApplicationApproved({ issuerEmail, issuerName, tokenSymbol, entityName, referenceNumber, complianceFee, auditorName, auditorEmail, paymentRef, bankName, bankAccountName, bankAccountNo, bankBranch, bankSwift }) {
  return send(issuerEmail, `✅ Application Approved — ${entityName} (${tokenSymbol})`,
    baseTemplate('Application Approved', `
      <p>Dear ${issuerName},</p>
      <p>Your tokenisation application for <strong>${entityName}</strong> (${tokenSymbol}) has been approved.</p>
      <div class="amount">$${parseFloat(complianceFee).toFixed(2)} USD</div>
      <p style="text-align:center;color:#6b7280;font-size:13px;margin-top:0;">TokenEquityX Compliance Review Fee</p>
      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">Bank Payment Details</h3>
      <div class="detail-row"><span>Bank</span><span>${bankName}</span></div>
      <div class="detail-row"><span>Account Name</span><span>${bankAccountName}</span></div>
      <div class="detail-row"><span>Account Number</span><span style="font-family:monospace">${bankAccountNo}</span></div>
      <div class="detail-row"><span>Payment Reference</span><span style="font-family:monospace;font-weight:bold;color:#C8972B">${paymentRef}</span></div>
      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">Nominated Auditor</h3>
      <div class="detail-row"><span>Auditor</span><span>${auditorName}</span></div>
      <div class="detail-row"><span>Email</span><span>${auditorEmail}</span></div>
      <a href="${PLATFORM}/issuer" class="btn btn-gold">View Your Application &rarr;</a>
    `));
}

async function notifyIssuerApplicationRejected({ issuerEmail, issuerName, tokenSymbol, entityName, referenceNumber, reason }) {
  return send(issuerEmail, `❌ Application Update — ${entityName} (${tokenSymbol})`,
    baseTemplate('Application Not Approved', `
      <p>Dear ${issuerName},</p>
      <p>Your application for <strong>${entityName}</strong> (${tokenSymbol}) was not approved at this time.</p>
      <div class="detail-row"><span>Reference</span><span style="font-family:monospace">${referenceNumber}</span></div>
      <div class="detail-row"><span>Reason</span><span class="danger">${reason || 'Does not meet current listing criteria'}</span></div>
      <p>You are welcome to address the concerns and resubmit.</p>
      <a href="${PLATFORM}/issuer" class="btn">Contact Support &rarr;</a>
    `));
}

async function notifyIssuerFeeReceivedAuditorAssigned({ issuerEmail, issuerName, tokenSymbol, entityName, referenceNumber, auditorName, estimatedDays }) {
  return send(issuerEmail, `🔍 Audit Commencing — ${entityName} (${tokenSymbol})`,
    baseTemplate('Audit & Compliance Review Commencing', `
      <p>Dear ${issuerName},</p>
      <p>Your compliance fee has been confirmed and the audit review is now underway.</p>
      <div class="detail-row"><span>Assigned Auditor</span><span>${auditorName || 'TokenEquityX Auditor'}</span></div>
      <div class="detail-row"><span>Estimated Duration</span><span>${estimatedDays || '10'} business days</span></div>
      <a href="${PLATFORM}/issuer" class="btn btn-gold">Track Your Application &rarr;</a>
    `));
}

module.exports = {
  send,
  notifyIssuerApplicationReceived,
  notifyIssuerApplicationApproved,
  notifyIssuerApplicationRejected,
  notifyIssuerFeeReceivedAuditorAssigned,
  notifyAdminDepositSubmitted,
  notifyInvestorDepositConfirmed,
  notifyInvestorDepositRejected,
  notifyAdminWithdrawalSubmitted,
  notifyInvestorWithdrawalProcessing,
  notifyInvestorWithdrawalCompleted,
  notifyInvestorWithdrawalRejected,
};
