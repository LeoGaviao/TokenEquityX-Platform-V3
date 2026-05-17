// api/src/utils/mailer.js
// Email service using Resend HTTP API
// Required env: RESEND_API_KEY, SMTP_FROM, ADMIN_EMAIL, PLATFORM_URL

const { Resend } = require('resend');

// Lazy-initialize so missing key doesn't crash the server on startup
let _resend = null;
function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

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
  console.log('[mailer] attempting send to:', to, '| subject:', subject);
  if (!process.env.RESEND_API_KEY) {
    console.log(`[MAILER] RESEND_API_KEY not set. Would send "${subject}" to ${to}`);
    return { skipped: true };
  }
  try {
    const client = getResend();
    const { data, error } = await client.emails.send({
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

async function notifyIssuerApplicationApproved({ issuerEmail, issuerName, tokenSymbol, entityName, complianceFee, paymentRef, bankName, bankAccountName, bankAccountNo, bankBranch, bankSwift }) {
  const deadline = (() => {
    const d = new Date();
    let days = 0;
    while (days < 7) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) days++;
    }
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  })();
  return send(issuerEmail, `✅ Committee Approved — Compliance Fee Invoice — ${tokenSymbol}`,
    baseTemplate('Application Approved by Committee', `
      <p>Dear ${issuerName},</p>
      <p>Your tokenisation application for <strong>${entityName}</strong> (${tokenSymbol}) has been approved at the Applications Appraisal Committee meeting.</p>
      <p>To proceed to the tokenisation and SECZ regulatory review stage, please settle the Compliance Review Fee by <strong>${deadline}</strong> (7 business days).</p>
      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">Compliance Review Fee</h3>
      <div class="amount">$${parseFloat(complianceFee).toFixed(2)} USD</div>
      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">Bank Payment Details</h3>
      <div class="detail-row"><span>Bank</span><span>${bankName || 'Stanbic Bank Zimbabwe'}</span></div>
      <div class="detail-row"><span>Account Name</span><span>${bankAccountName || 'TokenEquityX Ltd'}</span></div>
      <div class="detail-row"><span>Account Number</span><span style="font-family:monospace">${bankAccountNo || '—'}</span></div>
      ${bankBranch ? `<div class="detail-row"><span>Branch</span><span>${bankBranch}</span></div>` : ''}
      <div class="detail-row"><span>SWIFT Code</span><span style="font-family:monospace">${bankSwift || 'SBICZWHX'}</span></div>
      <div class="detail-row"><span>Payment Reference</span><span style="font-family:monospace;font-weight:bold;color:#C8972B">${paymentRef}</span></div>
      <p style="background:#fef3c7;border-left:4px solid #d97706;padding:12px 16px;border-radius:4px;font-size:13px;margin:20px 0 0;">
        <strong>Important:</strong> Use the payment reference <strong>${paymentRef}</strong> exactly as shown — payments without the correct reference cannot be matched to your application.<br/><br/>
        Once payment is made, email proof of payment to <strong>admin@tokenequityx.co.zw</strong>. Payment must be received within 7 business days of this notice (by <strong>${deadline}</strong>).
      </p>
      <a href="${PLATFORM}/issuer" class="btn btn-gold" style="margin-top:24px;">View Your Application &rarr;</a>
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

async function notifyAuditorAssigned({
  auditorEmail, auditorName, tokenSymbol, entityName, referenceNumber,
  assetType, sector, submissionDate, documentCount,
  revenue, ebitda, netAssets, totalDebt, valuationPrice,
}) {
  const deadline = (() => {
    const d = new Date();
    let days = 0;
    while (days < 10) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) days++;
    }
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  })();

  const fmt = n => n ? `$${parseFloat(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';
  const financialRows = [
    ['Revenue',                        fmt(revenue)],
    ['EBITDA',                         fmt(ebitda)],
    ['Net Assets',                     fmt(netAssets)],
    ['Total Debt',                     fmt(totalDebt)],
    ['Valuation Reference Price', valuationPrice ? `$${parseFloat(valuationPrice).toFixed(4)} per token` : '—'],
  ].map(([k, v]) => `<div class="detail-row"><span>${k}</span><span>${v}</span></div>`).join('');

  return send(auditorEmail, `[TokenEquityX] New Audit Assignment — ${tokenSymbol}`,
    baseTemplate('New Audit Assignment', `
      <p>Dear ${auditorName || 'Auditor'},</p>
      <p>You have been assigned to audit the following tokenisation application on the TokenEquityX platform. Please review all materials and submit your findings by <strong>${deadline}</strong>.</p>

      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">Assignment Details</h3>
      <div class="detail-row"><span>Entity / Company</span><span><strong>${entityName || tokenSymbol}</strong></span></div>
      <div class="detail-row"><span>Token Symbol</span><span style="font-family:monospace;font-weight:bold">${tokenSymbol}</span></div>
      <div class="detail-row"><span>Reference Number</span><span style="font-family:monospace">${referenceNumber || '—'}</span></div>
      <div class="detail-row"><span>Asset Type</span><span>${assetType || '—'}</span></div>
      <div class="detail-row"><span>Sector</span><span>${sector || '—'}</span></div>
      <div class="detail-row"><span>Submission Date</span><span>${submissionDate ? new Date(submissionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span></div>
      <div class="detail-row"><span>Documents Uploaded</span><span>${documentCount || 0}</span></div>

      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">Financial Data Summary</h3>
      ${financialRows}

      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">Expected Deliverables</h3>
      <ol style="color:#374151;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 20px;">
        <li>Review all ${documentCount || ''} uploaded documents (certificate of incorporation, prospectus, financials, valuation report, KYC docs, legal opinion, regulatory approval)</li>
        <li>Submit financial data to the TokenEquityX valuation engine via the auditor dashboard</li>
        <li>Certify the oracle price (fair market value per token)</li>
        <li>Set a risk rating: <strong>CONSERVATIVE / BALANCED / GROWTH / SPECULATIVE</strong></li>
        <li>Suggest a listing type: <strong>BROWNFIELD_BOURSE</strong> (main bourse — ≥3 yrs revenues ≥$1.5M) or <strong>GREENFIELD_P2P</strong> (peer-to-peer — early stage)</li>
        <li>Submit written audit findings and sign off the report in the auditor portal</li>
      </ol>

      <div style="background:#fef3c7;border-left:4px solid #d97706;padding:12px 16px;border-radius:4px;font-size:13px;margin:0 0 20px;">
        <strong>Deadline:</strong> ${deadline} (10 business days from today).<br/>
        Questions? Contact <a href="mailto:admin@tokenequityx.co.zw" style="color:#1A3C5E;">admin@tokenequityx.co.zw</a>
      </div>
      <a href="${PLATFORM}/auditor" class="btn btn-gold">Go to Auditor Dashboard &rarr;</a>
    `));
}

async function notifyIssuerComplianceFeeInvoice({
  issuerEmail, issuerName, entityName, tokenSymbol,
  complianceFee, paymentRef,
  bankName, bankAccountName, bankAccountNo, bankBranch, bankSwift,
}) {
  const deadline = (() => {
    const d = new Date();
    let days = 0;
    while (days < 7) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) days++;
    }
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  })();

  return send(issuerEmail, `🧾 Compliance Fee Invoice — ${tokenSymbol} — Action Required`,
    baseTemplate('Compliance Fee Invoice — Action Required', `
      <p>Dear ${issuerName},</p>
      <p>To proceed to the tokenisation and SECZ regulatory review stage, please settle the <strong>Compliance Review Fee</strong> by <strong>${deadline}</strong> (7 business days).</p>

      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">Compliance Review Fee</h3>
      <div class="amount">$${parseFloat(complianceFee).toFixed(2)} USD</div>

      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">Bank Payment Details</h3>
      <div class="detail-row"><span>Bank</span><span>${bankName || 'Stanbic Bank Zimbabwe'}</span></div>
      <div class="detail-row"><span>Account Name</span><span>${bankAccountName || 'TokenEquityX Ltd'}</span></div>
      <div class="detail-row"><span>Account Number</span><span style="font-family:monospace">${bankAccountNo || '—'}</span></div>
      ${bankBranch ? `<div class="detail-row"><span>Branch</span><span>${bankBranch}</span></div>` : ''}
      <div class="detail-row"><span>SWIFT Code</span><span style="font-family:monospace">${bankSwift || 'SBICZWHX'}</span></div>
      <div class="detail-row"><span>Payment Reference</span><span style="font-family:monospace;font-weight:bold;color:#C8972B">${paymentRef}</span></div>

      <p style="background:#fef3c7;border-left:4px solid #d97706;padding:12px 16px;border-radius:4px;font-size:13px;margin:20px 0 0;">
        <strong>Important:</strong> Use the payment reference <strong>${paymentRef}</strong> exactly as shown. Payments without the correct reference cannot be matched to your application.<br/><br/>
        Once payment is made, email proof of payment to <strong>admin@tokenequityx.co.zw</strong>. Payment must be received within 7 business days (by <strong>${deadline}</strong>).
      </p>
      <a href="${PLATFORM}/issuer" class="btn btn-gold" style="margin-top:24px;">View Your Application &rarr;</a>
    `));
}

async function notifyUserWelcome({ userEmail, userName, role }) {
  const dashboardPath = role === 'ISSUER' ? '/issuer' : role === 'AUDITOR' ? '/auditor' : '/investor';
  return send(userEmail, `Welcome to TokenEquityX — Africa's Digital Capital Market`,
    baseTemplate('Welcome to TokenEquityX', `
      <p>Dear ${userName},</p>
      <p>Your account has been created successfully on Africa's first regulated tokenised securities marketplace.</p>
      <div class="detail-row"><span>Email</span><span>${userEmail}</span></div>
      <div class="detail-row"><span>Role</span><span>${role || 'INVESTOR'}</span></div>
      <p style="margin-top:16px;">Please log in and complete your profile to get started.</p>
      <a href="${PLATFORM}${dashboardPath}" class="btn btn-gold">Go to Your Dashboard &rarr;</a>
    `));
}

async function notifyIssuerSeczSubmitted({ issuerEmail, issuerName, tokenSymbol, entityName }) {
  return send(issuerEmail, `🏛️ Submitted to SECZ — ${tokenSymbol}`,
    baseTemplate('Application Submitted to SECZ', `
      <p>Dear ${issuerName},</p>
      <p>Your tokenisation application for <strong>${entityName}</strong> (${tokenSymbol}) has been submitted to the <strong>Securities and Exchange Commission of Zimbabwe (SECZ)</strong> for regulatory review.</p>
      <p style="background:#fffbeb;border-left:4px solid #d97706;padding:12px 16px;border-radius:4px;font-size:14px;">You will be notified as soon as a regulatory decision is reached. This process typically takes a few business days.</p>
      <a href="${PLATFORM}/issuer" class="btn btn-gold">View Your Application &rarr;</a>
    `));
}

async function notifyIssuerSeczApproved({ issuerEmail, issuerName, tokenSymbol, entityName }) {
  return send(issuerEmail, `✅ SECZ Approved — ${tokenSymbol} — Ready to Launch`,
    baseTemplate('SECZ Approval Granted', `
      <p>Dear ${issuerName},</p>
      <p>Congratulations! Your tokenisation application for <strong>${entityName}</strong> (${tokenSymbol}) has received <strong>regulatory approval from SECZ</strong>.</p>
      <p style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;font-size:14px;">Your token is now cleared for listing. TokenEquityX will activate it on the platform shortly. You will receive a final notification when your token is live and trading begins.</p>
      <a href="${PLATFORM}/issuer" class="btn btn-gold">View Your Application &rarr;</a>
    `));
}

async function notifyIssuerTokenLive({ issuerEmail, issuerName, tokenSymbol, entityName, certifiedPrice, listingType, tradingMode }) {
  return send(issuerEmail, `🚀 ${tokenSymbol} is Now Live on TokenEquityX!`,
    baseTemplate('Your Token is Live!', `
      <p>Dear ${issuerName},</p>
      <p>Congratulations! <strong>${entityName} (${tokenSymbol})</strong> is now <strong class="success">LIVE</strong> on the TokenEquityX platform and available for trading.</p>
      <div class="detail-row"><span>Token Symbol</span><span style="font-family:monospace;font-weight:bold;color:#C8972B">${tokenSymbol}</span></div>
      <div class="detail-row"><span>Token Price</span><span style="font-weight:bold;color:#1A3C5E">$${parseFloat(certifiedPrice).toFixed(4)} USD</span></div>
      <div class="detail-row"><span>Listing Type</span><span>${listingType === 'BROWNFIELD_BOURSE' ? 'Main Bourse' : 'Peer-to-Peer'}</span></div>
      <div class="detail-row"><span>Trading Mode</span><span>${tradingMode}</span></div>
      <a href="${PLATFORM}/issuer" class="btn btn-gold" style="margin-top:24px;">View Your Token &rarr;</a>
    `));
}

async function notifyIssuerAuditReportSubmitted({ issuerEmail, issuerName, tokenSymbol, entityName, recommendation, certifiedPrice }) {
  const recColor = recommendation === 'APPROVE' ? '#16a34a' : recommendation === 'REJECT' ? '#dc2626' : '#d97706';
  return send(issuerEmail, `📋 Audit Report Submitted — ${tokenSymbol}`,
    baseTemplate('Audit Report Submitted', `
      <p>Dear ${issuerName},</p>
      <p>The independent auditor assigned to your tokenisation application for <strong>${entityName}</strong> (${tokenSymbol}) has submitted their review report.</p>
      <div class="detail-row"><span>Token</span><span style="font-family:monospace;font-weight:bold">${tokenSymbol}</span></div>
      <div class="detail-row"><span>Auditor Recommendation</span><span style="color:${recColor};font-weight:700">${recommendation}</span></div>
      <div class="detail-row"><span>Certified Oracle Price</span><span style="font-weight:700">$${parseFloat(certifiedPrice).toFixed(4)} per token</span></div>
      <p style="background:#fffbeb;border-left:4px solid #d97706;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px;">
        <strong>Next step:</strong> The platform administrator will now conduct the final committee review. You will be notified once a decision is reached.
      </p>
      <a href="${PLATFORM}/issuer" class="btn btn-gold">View Your Application &rarr;</a>
    `));
}

async function notifyIssuerInfoRequested({ issuerEmail, issuerName, tokenSymbol, entityName, notes }) {
  return send(issuerEmail, `⚠️ Action Required — Additional Information Requested — ${tokenSymbol}`,
    baseTemplate('Additional Information Required', `
      <p>Dear ${issuerName},</p>
      <p>The review team has requested additional information or documents for your tokenisation application for <strong>${entityName}</strong> (${tokenSymbol}).</p>
      ${notes ? `<div style="background:#f3f4f6;border-radius:8px;padding:12px 16px;margin:16px 0;"><p style="margin:0;font-size:14px;color:#374151;"><strong>Reviewer's Notes:</strong><br/>${notes}</p></div>` : ''}
      <p>Please log in to your issuer portal, navigate to the <strong>Application Journey</strong> tab, and provide the requested documents or information as soon as possible.</p>
      <p style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;font-size:14px;">
        Failure to provide the requested information within 10 business days may result in your application being suspended.
      </p>
      <a href="${PLATFORM}/issuer" class="btn btn-gold">Respond to Request &rarr;</a>
    `));
}

async function notifyInvestorOfferingCancelled({ investorEmail, investorName, tokenSymbol, amountRefunded }) {
  return send(investorEmail, `📢 Offering Cancelled — Refund Processed — ${tokenSymbol}`,
    baseTemplate('Primary Offering Cancelled — Refund Processed', `
      <p>Dear ${investorName},</p>
      <p>The primary offering for <strong>${tokenSymbol}</strong> has been cancelled by the platform administrator.</p>
      <p>Your subscription funds have been fully refunded to your TokenEquityX wallet balance.</p>
      <div class="amount" style="color:#16a34a">$${parseFloat(amountRefunded).toFixed(2)} USD</div>
      <div class="detail-row"><span>Status</span><span class="success">✔ Refunded to wallet</span></div>
      <p>You may use these funds to subscribe to other available offerings on the platform.</p>
      <a href="${PLATFORM}/investor" class="btn btn-gold">View Your Wallet &rarr;</a>
    `));
}

async function notifyIssuerOfferingApproved({ issuerEmail, issuerName, tokenSymbol, offeringPrice, targetRaise, deadline }) {
  const fmt = n => n ? `$${parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const deadlineFmt = deadline ? new Date(deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  return send(issuerEmail, `✅ Offering Approved — Now Open to Investors — ${tokenSymbol}`,
    baseTemplate('Primary Offering Approved', `
      <p>Dear ${issuerName},</p>
      <p>Your primary offering for <strong>${tokenSymbol}</strong> has been approved and is now <strong class="success">OPEN</strong> to investors.</p>
      <div class="detail-row"><span>Token Symbol</span><span style="font-family:monospace;font-weight:bold">${tokenSymbol}</span></div>
      <div class="detail-row"><span>Offering Price</span><span>${fmt(offeringPrice)} per token</span></div>
      <div class="detail-row"><span>Target Raise</span><span>${fmt(targetRaise)}</span></div>
      <div class="detail-row"><span>Subscription Deadline</span><span>${deadlineFmt}</span></div>
      <p style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px;">
        Investors can now subscribe through the TokenEquityX platform. Track subscription progress in your issuer dashboard.
      </p>
      <a href="${PLATFORM}/issuer" class="btn btn-gold">View Offering Dashboard &rarr;</a>
    `));
}

async function notifyIssuerOfferingRejected({ issuerEmail, issuerName, tokenSymbol, reason }) {
  return send(issuerEmail, `❌ Offering Proposal Rejected — ${tokenSymbol}`,
    baseTemplate('Offering Proposal Not Approved', `
      <p>Dear ${issuerName},</p>
      <p>Your primary offering proposal for <strong>${tokenSymbol}</strong> was not approved at this time.</p>
      <div class="detail-row"><span>Token</span><span style="font-family:monospace;font-weight:bold">${tokenSymbol}</span></div>
      <div class="detail-row"><span>Reason</span><span class="danger">${reason || 'Does not meet current offering requirements'}</span></div>
      <p>Please review the reason above, address any concerns, and resubmit your offering proposal through the issuer portal.</p>
      <a href="${PLATFORM}/issuer" class="btn">Review and Resubmit &rarr;</a>
    `));
}

async function notifyInvestorSubscriptionConfirmed({ investorEmail, investorName, tokenSymbol, amountUsd, tokensAllocated, deadline }) {
  const deadlineFmt = deadline ? new Date(deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  return send(investorEmail, `✅ Subscription Confirmed — ${tokenSymbol}`,
    baseTemplate('Subscription Confirmed', `
      <p>Dear ${investorName},</p>
      <p>Your subscription to the <strong>${tokenSymbol}</strong> primary offering has been confirmed.</p>
      <div class="amount" style="color:#1A3C5E">$${parseFloat(amountUsd).toFixed(2)} USD</div>
      <div class="detail-row"><span>Token Symbol</span><span style="font-family:monospace;font-weight:bold">${tokenSymbol}</span></div>
      <div class="detail-row"><span>Tokens Reserved</span><span style="font-weight:700">${parseInt(tokensAllocated).toLocaleString()} tokens</span></div>
      <div class="detail-row"><span>Status</span><span class="success">✔ Confirmed</span></div>
      <div class="detail-row"><span>Offering Deadline</span><span>${deadlineFmt}</span></div>
      <p style="background:#fffbeb;border-left:4px solid #d97706;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px;">
        <strong>Next step:</strong> Your tokens will be credited to your portfolio once the offering closes. No further action is required.
      </p>
      <a href="${PLATFORM}/investor" class="btn btn-gold">View Your Portfolio &rarr;</a>
    `));
}

module.exports = {
  send,
  notifyUserWelcome,
  notifyIssuerApplicationReceived,
  notifyIssuerApplicationApproved,
  notifyIssuerComplianceFeeInvoice,
  notifyIssuerApplicationRejected,
  notifyIssuerFeeReceivedAuditorAssigned,
  notifyIssuerSeczSubmitted,
  notifyIssuerSeczApproved,
  notifyIssuerTokenLive,
  notifyAuditorAssigned,
  notifyAdminDepositSubmitted,
  notifyInvestorDepositConfirmed,
  notifyInvestorDepositRejected,
  notifyAdminWithdrawalSubmitted,
  notifyInvestorWithdrawalProcessing,
  notifyInvestorWithdrawalCompleted,
  notifyInvestorWithdrawalRejected,
  notifyIssuerAuditReportSubmitted,
  notifyIssuerInfoRequested,
  notifyInvestorOfferingCancelled,
  notifyIssuerOfferingApproved,
  notifyIssuerOfferingRejected,
  notifyInvestorSubscriptionConfirmed,
};
