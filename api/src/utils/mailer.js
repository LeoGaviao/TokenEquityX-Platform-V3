// api/src/utils/mailer.js
// Email service using Nodemailer + Gmail SMTP (or any SMTP provider)
//
// Required .env variables:
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=587
//   SMTP_USER=notifications@tokenequityx.co.zw
//   SMTP_PASS=your_app_password
//   SMTP_FROM=TokenEquityX <notifications@tokenequityx.co.zw>
//   ADMIN_EMAIL=admin@tokenequityx.co.zw
//   PLATFORM_URL=http://localhost:3000

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM    = process.env.SMTP_FROM    || 'TokenEquityX <notifications@tokenequityx.co.zw>';
const ADMIN   = process.env.ADMIN_EMAIL  || 'admin@tokenequityx.co.zw';
const PLATFORM= process.env.PLATFORM_URL || 'https://tokenequityx.co.zw';

// ── Base HTML email wrapper
function baseTemplate(title, body) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
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
      <p>Africa's Digital Capital Market · SECZ Innovation Hub Sandbox</p>
    </div>
    <div class="body">
      <h2 style="margin:0 0 20px;color:#111827;font-size:20px;">${title}</h2>
      ${body}
    </div>
    <div class="footer">
      TokenEquityX Ltd · Harare, Zimbabwe · tokenequityx.co.zw<br/>
      This is an automated notification. Do not reply to this email.
    </div>
  </div>
</body>
</html>`;
}

// ── Send helper — fails silently in dev if SMTP not configured
async function send(to, subject, html) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[MAILER] SMTP not configured. Would send "${subject}" to ${to}`);
    return { skipped: true };
  }
  try {
    const info = await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`[MAILER] Sent "${subject}" to ${to} — ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`[MAILER] Failed to send "${subject}" to ${to}:`, err.message);
    return { error: err.message };
  }
}

// ════════════════════════════════════════════════════════
// DEPOSIT NOTIFICATIONS
// ════════════════════════════════════════════════════════

// → Admin: new deposit submitted
async function notifyAdminDepositSubmitted({ investorName, investorEmail, amount, reference, depositId }) {
  const subject = `💰 New Deposit Request — $${amount} from ${investorName}`;
  const html = baseTemplate('New Deposit Request', `
    <p>A new deposit request has been submitted and requires your confirmation.</p>
    <div class="amount">$${parseFloat(amount).toFixed(2)} USD</div>
    <div class="detail-row"><span>Investor</span><span>${investorName}</span></div>
    <div class="detail-row"><span>Email</span><span>${investorEmail}</span></div>
    <div class="detail-row"><span>Reference</span><span style="font-family:monospace">${reference}</span></div>
    <div class="detail-row"><span>Deposit ID</span><span style="font-family:monospace">${depositId}</span></div>
    <p style="margin-top:20px;">Please log into the Stanbic corporate banking portal and verify that a credit with this reference has been received, then confirm in the admin dashboard.</p>
    <a href="${PLATFORM}/admin" class="btn btn-gold">Go to Admin Dashboard →</a>
  `);
  return send(ADMIN, subject, html);
}

// → Investor: deposit confirmed
async function notifyInvestorDepositConfirmed({ investorEmail, investorName, amount, reference }) {
  const subject = `✅ Deposit Confirmed — $${amount} credited to your wallet`;
  const html = baseTemplate('Your Deposit Has Been Confirmed', `
    <p>Dear ${investorName},</p>
    <p>Your deposit has been verified and credited to your TokenEquityX wallet.</p>
    <div class="amount" style="color:#16a34a">$${parseFloat(amount).toFixed(2)} USD</div>
    <div class="detail-row"><span>Reference</span><span style="font-family:monospace">${reference}</span></div>
    <div class="detail-row"><span>Status</span><span class="success">✓ Confirmed</span></div>
    <p>Your funds are now available for investment. Visit your dashboard to browse listed assets.</p>
    <a href="${PLATFORM}/investor" class="btn btn-gold">Go to Dashboard →</a>
  `);
  return send(investorEmail, subject, html);
}

// → Investor: deposit rejected
async function notifyInvestorDepositRejected({ investorEmail, investorName, amount, reference, reason }) {
  const subject = `⚠️ Deposit Reference Not Verified — Action Required`;
  const html = baseTemplate('Deposit Could Not Be Verified', `
    <p>Dear ${investorName},</p>
    <p>We were unable to verify your deposit request. Please check the details below and contact support if you believe this is an error.</p>
    <div class="amount" style="color:#dc2626">$${parseFloat(amount).toFixed(2)} USD</div>
    <div class="detail-row"><span>Reference</span><span style="font-family:monospace">${reference}</span></div>
    <div class="detail-row"><span>Status</span><span class="danger">✗ Not Verified</span></div>
    ${reason ? `<div class="detail-row"><span>Reason</span><span>${reason}</span></div>` : ''}
    <p style="margin-top:16px;">Common reasons: reference number not found, amount mismatch, transfer still in transit. Please allow 24 hours for RTGS transfers to clear before resubmitting.</p>
    <a href="${PLATFORM}/investor" class="btn">Contact Support →</a>
  `);
  return send(investorEmail, subject, html);
}

// ════════════════════════════════════════════════════════
// WITHDRAWAL NOTIFICATIONS
// ════════════════════════════════════════════════════════

// → Admin: new withdrawal submitted
async function notifyAdminWithdrawalSubmitted({ investorName, investorEmail, amount, bankName, accountName, accountNumber, withdrawalId }) {
  const subject = `🏦 New Withdrawal Request — $${amount} from ${investorName}`;
  const html = baseTemplate('New Withdrawal Request', `
    <p>A withdrawal request has been submitted and requires processing.</p>
    <div class="amount">$${parseFloat(amount).toFixed(2)} USD</div>
    <div class="detail-row"><span>Investor</span><span>${investorName}</span></div>
    <div class="detail-row"><span>Email</span><span>${investorEmail}</span></div>
    <div class="detail-row"><span>Bank</span><span>${bankName}</span></div>
    <div class="detail-row"><span>Account Name</span><span>${accountName}</span></div>
    <div class="detail-row"><span>Account Number</span><span style="font-family:monospace">${accountNumber}</span></div>
    <div class="detail-row"><span>Withdrawal ID</span><span style="font-family:monospace">${withdrawalId}</span></div>
    <p style="margin-top:20px;">Please initiate the EFT/RTGS transfer from the TokenEquityX Stanbic custodial account, then mark as complete in the admin dashboard with the bank reference number.</p>
    <a href="${PLATFORM}/admin" class="btn btn-gold">Go to Admin Dashboard →</a>
  `);
  return send(ADMIN, subject, html);
}

// → Investor: withdrawal processing
async function notifyInvestorWithdrawalProcessing({ investorEmail, investorName, amount, bankName, accountNumber }) {
  const subject = `🏦 Withdrawal Being Processed — $${amount}`;
  const html = baseTemplate('Your Withdrawal Is Being Processed', `
    <p>Dear ${investorName},</p>
    <p>Your withdrawal request has been received and is being processed. The transfer will be initiated from our Stanbic custodial account.</p>
    <div class="amount" style="color:#d97706">$${parseFloat(amount).toFixed(2)} USD</div>
    <div class="detail-row"><span>Destination Bank</span><span>${bankName}</span></div>
    <div class="detail-row"><span>Account</span><span style="font-family:monospace">${accountNumber}</span></div>
    <div class="detail-row"><span>Status</span><span class="warning">⏳ Processing</span></div>
    <p style="margin-top:16px;">EFT transfers typically arrive within 1-2 business days. RTGS same-day transfers are available for amounts over USD 10,000.</p>
  `);
  return send(investorEmail, subject, html);
}

// → Investor: withdrawal completed
async function notifyInvestorWithdrawalCompleted({ investorEmail, investorName, amount, bankName, accountNumber, txReference }) {
  const subject = `✅ Withdrawal Completed — $${amount} sent to your bank`;
  const html = baseTemplate('Your Withdrawal Has Been Sent', `
    <p>Dear ${investorName},</p>
    <p>Your withdrawal has been processed and the funds have been sent to your bank account.</p>
    <div class="amount" style="color:#16a34a">$${parseFloat(amount).toFixed(2)} USD</div>
    <div class="detail-row"><span>Destination Bank</span><span>${bankName}</span></div>
    <div class="detail-row"><span>Account</span><span style="font-family:monospace">${accountNumber}</span></div>
    <div class="detail-row"><span>Bank Reference</span><span style="font-family:monospace">${txReference}</span></div>
    <div class="detail-row"><span>Status</span><span class="success">✓ Completed</span></div>
    <p style="margin-top:16px;">If funds have not arrived within 2 business days, please contact your bank with the reference number above.</p>
    <a href="${PLATFORM}/investor" class="btn">View Wallet History →</a>
  `);
  return send(investorEmail, subject, html);
}

// → Investor: withdrawal rejected
async function notifyInvestorWithdrawalRejected({ investorEmail, investorName, amount, reason }) {
  const subject = `❌ Withdrawal Request Rejected`;
  const html = baseTemplate('Withdrawal Could Not Be Processed', `
    <p>Dear ${investorName},</p>
    <p>Unfortunately your withdrawal request could not be processed at this time.</p>
    <div class="amount" style="color:#dc2626">$${parseFloat(amount).toFixed(2)} USD</div>
    <div class="detail-row"><span>Status</span><span class="danger">✗ Rejected</span></div>
    ${reason ? `<div class="detail-row"><span>Reason</span><span>${reason}</span></div>` : ''}
    <p style="margin-top:16px;">Your wallet balance has been restored. Please contact support if you have questions.</p>
    <a href="${PLATFORM}/investor" class="btn">Contact Support →</a>
  `);
  return send(investorEmail, subject, html);
}

module.exports = {
  notifyAdminDepositSubmitted,
  notifyInvestorDepositConfirmed,
  notifyInvestorDepositRejected,
  notifyAdminWithdrawalSubmitted,
  notifyInvestorWithdrawalProcessing,
  notifyInvestorWithdrawalCompleted,
  notifyInvestorWithdrawalRejected,
};
