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

async function notifyUserWelcome({ userEmail, userName, role, hasWallet = false }) {
  const dashboardPath = role === 'ISSUER' ? '/issuer' : role === 'AUDITOR' ? '/auditor' : '/investor';
  const walletPrompt = !hasWallet && role === 'INVESTOR' ? `
      <div style="margin:20px 0;padding:14px 16px;background:#fffbeb;border-left:4px solid #d97706;border-radius:4px;">
        <strong style="color:#92400e;">Connect your MetaMask wallet (recommended)</strong>
        <p style="margin:6px 0 0;color:#78350f;font-size:13px;">
          A connected wallet enables on-chain settlement, USDC transactions, and token transfers.
          You can link your wallet at any time from <strong>Profile → Security → Wallet Settings</strong>.
        </p>
      </div>` : '';
  return send(userEmail, `Welcome to TokenEquityX — Africa's Digital Capital Market`,
    baseTemplate('Welcome to TokenEquityX', `
      <p>Dear ${userName},</p>
      <p>Your account has been created successfully on Africa's first regulated tokenised securities marketplace.</p>
      <div class="detail-row"><span>Email</span><span>${userEmail}</span></div>
      <div class="detail-row"><span>Role</span><span>${role || 'INVESTOR'}</span></div>
      ${walletPrompt}
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

async function notifyIssuerTokenTradingLive({ issuerEmail, issuerName, tokenSymbol, marketState, listingDate, oraclePrice }) {
  const modeLabel = marketState === 'FULL_TRADING' ? 'Full Secondary Market Trading' : 'P2P-Only Trading';
  const dateFmt = listingDate ? new Date(listingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Today';
  const priceFmt = oraclePrice ? `$${parseFloat(oraclePrice).toFixed(4)} USD` : '—';
  return send(issuerEmail, `🚀 ${tokenSymbol} Is Now Live for Trading`,
    baseTemplate('Your Token Is Now Live for Trading', `
      <p>Dear ${issuerName},</p>
      <p><strong>${tokenSymbol}</strong> is now live on the TokenEquityX secondary market.</p>
      <div class="detail-row"><span>Token Symbol</span><span style="font-family:monospace;font-weight:bold">${tokenSymbol}</span></div>
      <div class="detail-row"><span>Market Mode</span><span style="font-weight:700;color:#16a34a">${modeLabel}</span></div>
      <div class="detail-row"><span>Oracle Price</span><span>${priceFmt}</span></div>
      <div class="detail-row"><span>Listing Date</span><span>${dateFmt}</span></div>
      <p style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px;">
        Investors who subscribed during the primary offering have received their tokens. Secondary market trading is now available.
      </p>
      <a href="${PLATFORM}/issuer" class="btn btn-gold">View Your Token &rarr;</a>
    `));
}

async function notifyInvestorTradeFilled({ investorEmail, investorName, tokenSymbol, side, quantity, pricePerToken, total, settlementRail }) {
  const isBuy = side === 'BUY';
  const fmt = n => n ? `$${parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const fmtPrice = n => n ? `$${parseFloat(n).toFixed(4)}` : '—';
  return send(investorEmail,
    isBuy ? `✅ Trade Confirmed — ${tokenSymbol} Purchase` : `✅ Trade Confirmed — ${tokenSymbol} Sale`,
    baseTemplate(
      isBuy ? `Trade Confirmed — ${tokenSymbol} Purchase` : `Trade Confirmed — ${tokenSymbol} Sale`,
      `
      <p>Dear ${investorName},</p>
      <p>Your ${isBuy ? 'buy' : 'sell'} order for <strong>${tokenSymbol}</strong> has been matched and settled.</p>
      <div class="detail-row"><span>Token</span><span style="font-family:monospace;font-weight:bold">${tokenSymbol}</span></div>
      <div class="detail-row"><span>Side</span><span style="font-weight:700;color:${isBuy ? '#16a34a' : '#dc2626'}">${isBuy ? '▲ BUY' : '▼ SELL'}</span></div>
      <div class="detail-row"><span>${isBuy ? 'Quantity Bought' : 'Quantity Sold'}</span><span style="font-weight:700">${parseInt(quantity).toLocaleString()} tokens</span></div>
      <div class="detail-row"><span>Price Per Token</span><span>${fmtPrice(pricePerToken)}</span></div>
      <div class="detail-row"><span>${isBuy ? 'Total Cost' : 'Gross Proceeds'}</span><span style="font-weight:700">${fmt(total)}</span></div>
      ${settlementRail ? `<div class="detail-row"><span>Settlement Rail</span><span>${settlementRail}</span></div>` : ''}
      <div class="detail-row"><span>Status</span><span class="success">✔ Settled</span></div>
      <a href="${PLATFORM}/investor" class="btn btn-gold">View Your Portfolio &rarr;</a>
    `));
}

async function notifyAdminAuditorDeclined({ tokenSymbol, entityName, auditorEmail, declineReason, referenceNumber }) {
  return send(ADMIN, `🚨 URGENT — Auditor Declined Assignment — ${tokenSymbol}`,
    baseTemplate('URGENT: Auditor Declined — Reassignment Required', `
      <p>An auditor has declined their assignment. A replacement must be nominated immediately to avoid delays in the tokenisation pipeline.</p>
      <div class="detail-row"><span>Token Symbol</span><span style="font-family:monospace;font-weight:bold">${tokenSymbol}</span></div>
      <div class="detail-row"><span>Entity</span><span>${entityName || '—'}</span></div>
      <div class="detail-row"><span>Auditor Email</span><span style="font-family:monospace">${auditorEmail || '—'}</span></div>
      <div class="detail-row"><span>Reference</span><span style="font-family:monospace">${referenceNumber || '—'}</span></div>
      ${declineReason ? `<div class="detail-row"><span>Decline Reason</span><span class="danger">${declineReason}</span></div>` : ''}
      <p style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;font-size:14px;margin:20px 0;">
        <strong>Action Required:</strong> Reassign a new auditor immediately via the <strong>Pipeline</strong> tab in the admin dashboard.
      </p>
      <a href="${PLATFORM}/admin" class="btn btn-gold">Go to Pipeline &rarr;</a>
    `));
}

async function notifyIssuerApplicationSuspended({ issuerEmail, issuerName, tokenSymbol, entityName, reason, referenceNumber }) {
  return send(issuerEmail, `⚠️ IMPORTANT — Token Listing Suspended — ${tokenSymbol}`,
    baseTemplate('Token Listing Suspended', `
      <p>Dear ${issuerName},</p>
      <p>Your listing for <strong>${entityName}</strong> (${tokenSymbol}) has been suspended by the TokenEquityX platform administrator.</p>
      <div class="detail-row"><span>Token Symbol</span><span style="font-family:monospace;font-weight:bold">${tokenSymbol}</span></div>
      ${reason ? `<div class="detail-row"><span>Suspension Reason</span><span class="danger">${reason}</span></div>` : ''}
      <div class="detail-row"><span>Reference</span><span style="font-family:monospace">${referenceNumber || '—'}</span></div>
      <div class="detail-row"><span>Appeal Window</span><span style="font-weight:700">90 days from suspension date</span></div>
      <p style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px;">
        <strong>Your 90-Day Appeal Window is Now Open.</strong> Your application data will be retained for 90 days. To appeal this decision, contact <a href="mailto:admin@tokenequityx.co.zw" style="color:#1A3C5E;">admin@tokenequityx.co.zw</a> within 90 days. If no appeal is received, all data will be permanently deleted.
      </p>
      <a href="${PLATFORM}/issuer" class="btn">Contact Admin to Appeal &rarr;</a>
    `));
}

async function notifyIssuerApplicationReinstated({ issuerEmail, issuerName, tokenSymbol, entityName, referenceNumber }) {
  return send(issuerEmail, `✅ Token Listing Reinstated — ${tokenSymbol}`,
    baseTemplate('Token Listing Reinstated', `
      <p>Dear ${issuerName},</p>
      <p>Your listing for <strong>${entityName}</strong> (${tokenSymbol}) has been reinstated by the platform administrator. Your application is now back in <strong>PENDING</strong> status.</p>
      <div class="detail-row"><span>Token Symbol</span><span style="font-family:monospace;font-weight:bold">${tokenSymbol}</span></div>
      <div class="detail-row"><span>Status Restored</span><span class="success">✔ PENDING</span></div>
      <div class="detail-row"><span>Reference</span><span style="font-family:monospace">${referenceNumber || '—'}</span></div>
      <p style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px;">
        <strong>Next steps:</strong> Log in to your issuer dashboard to review your application. Please address any outstanding requirements and contact <a href="mailto:admin@tokenequityx.co.zw" style="color:#1A3C5E;">admin@tokenequityx.co.zw</a> if you need guidance.
      </p>
      <a href="${PLATFORM}/issuer" class="btn btn-gold">View Your Application &rarr;</a>
    `));
}

async function notifyStaffAccountCreated({ userEmail, userName, role, loginUrl }) {
  const url = loginUrl || `${PLATFORM}/login`;
  return send(userEmail, `Your TokenEquityX Staff Account is Ready`,
    baseTemplate('Your Staff Account Has Been Created', `
      <p>Dear ${userName},</p>
      <p>An account has been created for you on the TokenEquityX platform. You can now log in and access your dashboard.</p>
      <div class="detail-row"><span>Full Name</span><span style="font-weight:700">${userName}</span></div>
      <div class="detail-row"><span>Email</span><span style="font-family:monospace">${userEmail}</span></div>
      <div class="detail-row"><span>Role</span><span style="font-weight:700">${role}</span></div>
      <div class="detail-row"><span>Login URL</span><span><a href="${url}" style="color:#1A3C5E;">${url}</a></span></div>
      <p style="background:#fffbeb;border-left:4px solid #d97706;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px;">
        <strong>Security Notice:</strong> Please change your password on first login. If you did not expect this email, contact <a href="mailto:admin@tokenequityx.co.zw" style="color:#1A3C5E;">admin@tokenequityx.co.zw</a> immediately.
      </p>
      <a href="${url}" class="btn btn-gold">Log In Now &rarr;</a>
    `));
}

async function notifyInvestorKycSubmitted({ investorEmail, investorName }) {
  return send(investorEmail, `KYC Submitted — Under Review`,
    baseTemplate('Your KYC Submission Is Under Review', `
      <p>Dear ${investorName},</p>
      <p>Thank you for completing your identity verification. Your documents have been received and are now under review by the TokenEquityX compliance team.</p>
      <div class="detail-row"><span>Status</span><span class="warning">⏳ Under Review</span></div>
      <div class="detail-row"><span>Estimated Review Time</span><span>24 – 48 business hours</span></div>
      <p style="margin-top:16px;">You will receive an email notification as soon as a decision has been reached. No further action is required at this time.</p>
      <p style="background:#fffbeb;border-left:4px solid #d97706;padding:12px 16px;border-radius:4px;font-size:14px;">
        If you need to provide additional documents or have questions about your submission, contact <a href="mailto:compliance@tokenequityx.co.zw" style="color:#1A3C5E;">compliance@tokenequityx.co.zw</a>.
      </p>
      <a href="${PLATFORM}/investor" class="btn btn-gold">Go to Your Dashboard &rarr;</a>
    `));
}

async function notifyIssuerMarketStateChanged({ issuerEmail, issuerName, tokenSymbol, previousState, newState, effectiveDate, reason }) {
  const dateFmt = effectiveDate ? new Date(effectiveDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Today';
  const stateLabel = s => ({ PRE_LAUNCH: 'Pre-Launch', P2P_ONLY: 'P2P-Only Trading', LIMITED_TRADING: 'Limited Trading', FULL_TRADING: 'Full Trading', HALTED: 'HALTED' }[s] || s);
  const isHalted = newState === 'HALTED';
  return send(issuerEmail, `📢 Token Market State Updated — ${tokenSymbol}`,
    baseTemplate('Token Market State Changed', `
      <p>Dear ${issuerName},</p>
      <p>The market state for your token <strong>${tokenSymbol}</strong> has been updated by the platform administrator.</p>
      <div class="detail-row"><span>Token Symbol</span><span style="font-family:monospace;font-weight:bold">${tokenSymbol}</span></div>
      <div class="detail-row"><span>Previous State</span><span style="color:#6b7280">${stateLabel(previousState)}</span></div>
      <div class="detail-row"><span>New State</span><span style="font-weight:700;color:${isHalted ? '#dc2626' : '#16a34a'}">${stateLabel(newState)}</span></div>
      <div class="detail-row"><span>Effective Date</span><span>${dateFmt}</span></div>
      ${reason ? `<div class="detail-row"><span>Reason</span><span>${reason}</span></div>` : ''}
      ${isHalted
        ? '<p style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px;"><strong>Trading has been suspended.</strong> Contact <a href="mailto:admin@tokenequityx.co.zw" style="color:#1A3C5E;">admin@tokenequityx.co.zw</a> for details.</p>'
        : '<p style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px;">Your token is now live in the new market state. Log in to your issuer dashboard to monitor performance.</p>'
      }
      <a href="${PLATFORM}/issuer" class="btn btn-gold">View Your Token &rarr;</a>
    `));
}

async function notifyIssuerOfferingProposed({ issuerEmail, issuerName, tokenSymbol, offeringPrice, targetRaise, tokensOffered, submittedAt }) {
  const fmt = n => n ? `$${parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const dateFmt = submittedAt ? new Date(submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Today';
  return send(issuerEmail, `📊 Offering Proposal Submitted — ${tokenSymbol}`,
    baseTemplate('Offering Proposal Submitted', `
      <p>Dear ${issuerName},</p>
      <p>Your primary offering proposal for <strong>${tokenSymbol}</strong> has been received and is now pending auditor review and admin approval.</p>
      <div class="detail-row"><span>Token Symbol</span><span style="font-family:monospace;font-weight:bold">${tokenSymbol}</span></div>
      <div class="detail-row"><span>Offering Price</span><span>${fmt(offeringPrice)} per token</span></div>
      <div class="detail-row"><span>Target Raise</span><span>${fmt(targetRaise)}</span></div>
      <div class="detail-row"><span>Tokens Offered</span><span>${parseInt(tokensOffered).toLocaleString()}</span></div>
      <div class="detail-row"><span>Submitted</span><span>${dateFmt}</span></div>
      <div class="detail-row"><span>Status</span><span class="warning">⏳ Pending Approval</span></div>
      <p style="background:#fffbeb;border-left:4px solid #d97706;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px;">
        Your offering will be reviewed by our auditor and then approved by the admin committee. You will be notified at each stage.
      </p>
      <a href="${PLATFORM}/issuer" class="btn btn-gold">Track Your Offering &rarr;</a>
    `));
}

async function notifyInvestorOfferingClosed({ investorEmail, investorName, tokenSymbol, tokensReceived, pricePerToken, totalInvestment }) {
  const fmt = n => n ? `$${parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  return send(investorEmail, `🎉 Offering Closed — ${tokenSymbol} Tokens Credited to Your Portfolio`,
    baseTemplate('Offering Closed — Tokens Credited', `
      <p>Dear ${investorName},</p>
      <p>The primary offering for <strong>${tokenSymbol}</strong> has closed. Your tokens have been credited to your portfolio and are now available for secondary market trading.</p>
      <div class="detail-row"><span>Token Symbol</span><span style="font-family:monospace;font-weight:bold">${tokenSymbol}</span></div>
      <div class="detail-row"><span>Tokens Received</span><span style="font-weight:700">${parseInt(tokensReceived).toLocaleString()} tokens</span></div>
      <div class="detail-row"><span>Price Per Token</span><span>${fmt(pricePerToken)}</span></div>
      <div class="detail-row"><span>Total Investment</span><span style="font-weight:700">${fmt(totalInvestment)}</span></div>
      <div class="detail-row"><span>Status</span><span class="success">✔ Tokens Credited</span></div>
      <p style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px;">
        Your ${tokenSymbol} tokens are now live in your portfolio and eligible for secondary market trading.
      </p>
      <a href="${PLATFORM}/investor" class="btn btn-gold">View Your Portfolio &rarr;</a>
    `));
}

async function notifyIssuerProceedsDisbursed({ issuerEmail, issuerName, tokenSymbol, entityName, grossAmount, feesDeducted, netAmount, bankReference }) {
  const fmt = n => n ? `$${parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  return send(issuerEmail, `💰 Proceeds Disbursed — ${tokenSymbol}`,
    baseTemplate('Offering Proceeds Disbursed', `
      <p>Dear ${issuerName},</p>
      <p>The net proceeds from the primary offering for <strong>${entityName || tokenSymbol}</strong> (${tokenSymbol}) have been disbursed to your bank account.</p>
      <div class="amount" style="color:#16a34a">${fmt(netAmount)}</div>
      <div class="detail-row"><span>Gross Amount Raised</span><span>${fmt(grossAmount)}</span></div>
      <div class="detail-row"><span>Platform Fees &amp; Levies</span><span class="danger">−${fmt(feesDeducted)}</span></div>
      <div class="detail-row"><span>Net Disbursed</span><span style="font-weight:800;color:#16a34a">${fmt(netAmount)}</span></div>
      ${bankReference ? `<div class="detail-row"><span>Bank Reference</span><span style="font-family:monospace">${bankReference}</span></div>` : ''}
      <div class="detail-row"><span>Status</span><span class="success">✔ Disbursed</span></div>
      <p style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px;">
        Funds have been processed by the banking partner. Please allow 1-2 business days for the transfer to reflect in your account.
      </p>
      <a href="${PLATFORM}/issuer" class="btn btn-gold">View Your Dashboard &rarr;</a>
    `));
}

async function notifyIssuerEntityKycApproved({ issuerEmail, issuerName, entityName, registrationNumber, approvalDate }) {
  const dateFmt = approvalDate ? new Date(approvalDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Today';
  return send(issuerEmail, `✅ Entity KYC Approved — ${entityName}`,
    baseTemplate('Entity KYC & AML Verification Approved', `
      <p>Dear ${issuerName},</p>
      <p>Congratulations! Your Entity KYC & AML verification for <strong>${entityName}</strong> has been approved by the TokenEquityX compliance team.</p>
      <div class="detail-row"><span>Entity Name</span><span style="font-weight:700">${entityName}</span></div>
      <div class="detail-row"><span>Registration Number</span><span style="font-family:monospace">${registrationNumber || '—'}</span></div>
      <div class="detail-row"><span>Approval Date</span><span>${dateFmt}</span></div>
      <div class="detail-row"><span>Status</span><span class="success">✔ Approved</span></div>
      <p style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px;">
        <strong>Next step:</strong> You may now proceed with your tokenisation application. Go to the <strong>Tokenisation Application</strong> section of your issuer dashboard to begin.
      </p>
      <a href="${PLATFORM}/issuer" class="btn btn-gold">Start Your Application &rarr;</a>
    `));
}

async function notifyIssuerEntityKycRejected({ issuerEmail, issuerName, entityName, reason }) {
  return send(issuerEmail, `❌ Entity KYC Not Approved — ${entityName}`,
    baseTemplate('Entity KYC Verification Not Approved', `
      <p>Dear ${issuerName},</p>
      <p>Your Entity KYC & AML submission for <strong>${entityName}</strong> has not been approved at this time.</p>
      ${reason ? `<div class="detail-row"><span>Reason</span><span class="danger">${reason}</span></div>` : ''}
      <p>You may resubmit after addressing the issues raised. Our compliance team is available to answer questions.</p>
      <p style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;font-size:14px;">
        Please contact <a href="mailto:compliance@tokenequityx.co.zw" style="color:#1A3C5E;">compliance@tokenequityx.co.zw</a> for guidance before resubmitting.
      </p>
      <a href="${PLATFORM}/issuer" class="btn">Contact Compliance &rarr;</a>
    `));
}

async function notifyInvestorKycApproved({ investorEmail, investorName }) {
  const approvalDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return send(investorEmail, `✅ KYC Approved — You Can Now Invest`,
    baseTemplate('KYC Approved — You Can Now Invest', `
      <p>Dear ${investorName},</p>
      <p>Congratulations! Your identity verification (KYC) has been approved by the TokenEquityX compliance team.</p>
      <div class="detail-row"><span>Status</span><span class="success">✔ Approved</span></div>
      <div class="detail-row"><span>Approval Date</span><span>${approvalDate}</span></div>
      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">Next Steps</h3>
      <ol style="color:#374151;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 20px;">
        <li><strong>Deposit Funds</strong> — Add USD to your wallet via bank transfer</li>
        <li><strong>Browse Listings</strong> — Explore tokenised securities available on the platform</li>
        <li><strong>Subscribe to Offerings</strong> — Participate in primary offerings to build your portfolio</li>
      </ol>
      <p style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;font-size:14px;">
        You now have full access to all investor features including secondary market trading, dividend claims, and governance voting.
      </p>
      <a href="${PLATFORM}/investor" class="btn btn-gold">Go to Your Dashboard &rarr;</a>
    `));
}

async function notifyInvestorKycRejected({ investorEmail, investorName, reason }) {
  return send(investorEmail, `KYC Review — Additional Information Required`,
    baseTemplate('KYC Review — Additional Information Required', `
      <p>Dear ${investorName},</p>
      <p>Your KYC submission could not be approved at this time. Please review the information below and resubmit your documents.</p>
      <div class="detail-row"><span>Status</span><span class="danger">✗ Not Approved</span></div>
      ${reason ? `<div class="detail-row"><span>Reason</span><span class="danger">${reason}</span></div>` : ''}
      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">How to Resubmit</h3>
      <ol style="color:#374151;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 20px;">
        <li>Review the reason noted above and gather the required documents</li>
        <li>Ensure all documents are clear, valid, and not expired</li>
        <li>Log in to your investor dashboard and navigate to the <strong>KYC / Verification</strong> section</li>
        <li>Resubmit your updated documents for review</li>
      </ol>
      <p style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;font-size:14px;">
        If you need assistance, contact our compliance team at <a href="mailto:compliance@tokenequityx.co.zw" style="color:#1A3C5E;">compliance@tokenequityx.co.zw</a>.
      </p>
      <a href="${PLATFORM}/investor" class="btn btn-gold">Resubmit KYC &rarr;</a>
    `));
}

async function notifyInvestorDepositInstructions({ investorEmail, investorName, amount, reference, depositId }) {
  return send(investorEmail, `Deposit Instructions — ${reference}`,
    baseTemplate('Deposit Instructions', `
      <p>Dear ${investorName},</p>
      <p>Your deposit request has been received. Please make your bank transfer using the details below. <strong>You must quote the reference number exactly as shown.</strong></p>
      <div class="amount">$${parseFloat(amount).toFixed(2)} USD</div>
      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">Bank Transfer Details</h3>
      <div class="detail-row"><span>Bank</span><span>Stanbic Bank Zimbabwe</span></div>
      <div class="detail-row"><span>Account Name</span><span>TokenEquityX Ltd</span></div>
      <div class="detail-row"><span>Payment Reference</span><span style="font-family:monospace;font-weight:bold;color:#C8972B">${reference}</span></div>
      <div class="detail-row"><span>Amount</span><span style="font-weight:700">$${parseFloat(amount).toFixed(2)} USD</span></div>
      <div class="detail-row"><span>Payment Deadline</span><span class="warning">Within 48 hours</span></div>
      <div class="detail-row"><span>Deposit ID</span><span style="font-family:monospace">${depositId}</span></div>
      <p style="background:#fef3c7;border-left:4px solid #d97706;padding:12px 16px;border-radius:4px;font-size:13px;margin:20px 0 0;">
        <strong>Important:</strong> Always quote reference <strong>${reference}</strong> on your transfer. Transfers without the correct reference cannot be matched to your account and will be delayed.<br/><br/>
        Your funds will reflect in your wallet once our team confirms receipt of the bank credit. This typically takes 1–4 business hours during working hours.
      </p>
      <a href="${PLATFORM}/investor" class="btn btn-gold">Go to Your Dashboard &rarr;</a>
    `));
}

async function notifyInvestorDistributionReceived({ investorEmail, investorName, tokenSymbol, grossAmount, withholdingRate, withholdingTax, netAmount, tokenBalance, distributionDate }) {
  const dateFmt = distributionDate
    ? new Date(distributionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const fmt = n => `$${parseFloat(n || 0).toFixed(4)}`;
  return send(investorEmail, `Distribution Received — ${tokenSymbol}`,
    baseTemplate(`Distribution Received — ${tokenSymbol}`, `
      <p>Dear ${investorName},</p>
      <p>Your distribution claim for <strong>${tokenSymbol}</strong> has been processed and credited to your wallet.</p>
      <div class="amount" style="color:#16a34a">${fmt(netAmount)} USD</div>
      <div class="detail-row"><span>Token Symbol</span><span style="font-family:monospace;font-weight:bold">${tokenSymbol}</span></div>
      <div class="detail-row"><span>Token Holdings</span><span style="font-weight:700">${parseFloat(tokenBalance || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} tokens</span></div>
      <div class="detail-row"><span>Gross Distribution</span><span>${fmt(grossAmount)}</span></div>
      <div class="detail-row"><span>Withholding Tax (${(parseFloat(withholdingRate || 0) * 100).toFixed(0)}%)</span><span class="danger">−${fmt(withholdingTax)}</span></div>
      <div class="detail-row"><span>Net Credited to Wallet</span><span style="font-weight:800;color:#16a34a">${fmt(netAmount)}</span></div>
      <div class="detail-row"><span>Distribution Date</span><span>${dateFmt}</span></div>
      <div class="detail-row"><span>Status</span><span class="success">✔ Credited</span></div>
      <p style="background:#fffbeb;border-left:4px solid #d97706;padding:12px 16px;border-radius:4px;font-size:13px;margin-top:16px;">
        The withholding tax of ${fmt(withholdingTax)} has been remitted to ZIMRA in accordance with the Zimbabwe Income Tax Act.
      </p>
      <a href="${PLATFORM}/investor" class="btn btn-gold">View Your Wallet &rarr;</a>
    `));
}

async function notifyInvestorKycExpiring({ investorEmail, investorName, expiryDate }) {
  const dateFmt = expiryDate
    ? new Date(expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
  return send(investorEmail, `Action Required — KYC Expiry in 30 Days`,
    baseTemplate('Your KYC Verification Is Expiring Soon', `
      <p>Dear ${investorName},</p>
      <p>Your identity verification (KYC) on TokenEquityX is due to expire in <strong>30 days</strong>. Please renew your KYC to continue trading uninterrupted.</p>
      <div class="detail-row"><span>KYC Expiry Date</span><span class="warning">${dateFmt}</span></div>
      <div class="detail-row"><span>Days Remaining</span><span class="warning">30 days</span></div>
      <p style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;font-size:14px;margin:20px 0;">
        <strong>Important:</strong> If your KYC expires, your trading access will be suspended until you complete a renewal. This includes secondary market trading, new subscriptions, and withdrawals.
      </p>
      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">How to Renew</h3>
      <ol style="color:#374151;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 20px;">
        <li>Log in to your investor dashboard</li>
        <li>Navigate to the <strong>KYC / Verification</strong> section</li>
        <li>Submit your updated identity documents</li>
        <li>Allow 24–48 hours for our compliance team to review</li>
      </ol>
      <a href="${PLATFORM}/investor" class="btn btn-gold">Renew KYC Now &rarr;</a>
    `));
}

async function notifyIssuerKycApproved({ issuerEmail, issuerName }) {
  const approvalDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return send(issuerEmail, `✅ KYC Approved — You Can Now Submit Your Tokenisation Application`,
    baseTemplate('KYC Approved — Next Step: Entity KYC & Tokenisation Application', `
      <p>Dear ${issuerName},</p>
      <p>Congratulations! Your personal identity verification (KYC) has been approved by the TokenEquityX compliance team.</p>
      <div class="detail-row"><span>Status</span><span class="success">✔ Approved</span></div>
      <div class="detail-row"><span>Approval Date</span><span>${approvalDate}</span></div>
      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">Your Next Steps</h3>
      <ol style="color:#374151;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 20px;">
        <li>Log in to your <strong>Issuer Portal</strong></li>
        <li>Complete the <strong>Entity KYC</strong> for your company (corporate identity verification)</li>
        <li>Once Entity KYC is approved, proceed to the <strong>Tokenisation Application</strong> journey</li>
        <li>Upload your financial statements, valuation model, and supporting documents</li>
      </ol>
      <p style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;font-size:14px;">
        Your personal KYC is now complete. The Entity KYC step verifies your company's identity and is required before your tokenisation application can proceed to audit.
      </p>
      <a href="${PLATFORM}/issuer" class="btn btn-gold">Go to Issuer Portal &rarr;</a>
    `));
}

async function notifyIssuerKycRejected({ issuerEmail, issuerName, reason }) {
  return send(issuerEmail, `KYC Review — Action Required`,
    baseTemplate('KYC Review — Action Required', `
      <p>Dear ${issuerName},</p>
      <p>Your KYC submission could not be approved at this time. Please review the information below and resubmit your documents through the Issuer Portal.</p>
      <div class="detail-row"><span>Status</span><span class="danger">✗ Not Approved</span></div>
      ${reason ? `<div class="detail-row"><span>Reason</span><span class="danger">${reason}</span></div>` : ''}
      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">What to Correct</h3>
      <ol style="color:#374151;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 20px;">
        <li>Review the reason noted above and gather the required documents</li>
        <li>Ensure all identity documents are clear, valid, and not expired</li>
        <li>Log in to the Issuer Portal and navigate to <strong>My KYC</strong></li>
        <li>Resubmit your updated documents for review</li>
      </ol>
      <p style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;font-size:14px;">
        If you need assistance, contact our compliance team at <a href="mailto:compliance@tokenequityx.co.zw" style="color:#1A3C5E;">compliance@tokenequityx.co.zw</a>.
      </p>
      <a href="${PLATFORM}/issuer" class="btn btn-gold">Resubmit via Issuer Portal &rarr;</a>
    `));
}

async function notifyAuditorKycApproved({ auditorEmail, auditorName }) {
  const approvalDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return send(auditorEmail, `✅ KYC Approved — Your Auditor Account is Ready`,
    baseTemplate('KYC Approved — Your Auditor Account is Ready', `
      <p>Dear ${auditorName},</p>
      <p>Your identity verification (KYC) has been approved. Your auditor account on TokenEquityX is now fully active.</p>
      <div class="detail-row"><span>Status</span><span class="success">✔ Approved</span></div>
      <div class="detail-row"><span>Approval Date</span><span>${approvalDate}</span></div>
      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">What You Can Do Now</h3>
      <ul style="color:#374151;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 20px;">
        <li>Receive and accept tokenisation audit assignments</li>
        <li>Submit valuation models and audit reports</li>
        <li>Access issuer financial data packages for assigned tokens</li>
        <li>Communicate with issuers via the secure messaging system</li>
      </ul>
      <p style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;font-size:14px;">
        Audit assignments will be sent to you by the platform administrator. You will receive a notification when a new assignment is ready for acceptance.
      </p>
      <a href="${PLATFORM}/auditor" class="btn btn-gold">Go to Auditor Dashboard &rarr;</a>
    `));
}

async function notifyPartnerKycApproved({ partnerEmail, partnerName }) {
  const approvalDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return send(partnerEmail, `✅ KYC Approved — Your Partner Account is Active`,
    baseTemplate('KYC Approved — Your Partner Account is Active', `
      <p>Dear ${partnerName},</p>
      <p>Your identity verification (KYC) has been approved. Your partner account on TokenEquityX is now active.</p>
      <div class="detail-row"><span>Status</span><span class="success">✔ Approved</span></div>
      <div class="detail-row"><span>Approval Date</span><span>${approvalDate}</span></div>
      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">Your Partner Dashboard is Live</h3>
      <ul style="color:#374151;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 20px;">
        <li>Begin referring investors and issuers to the platform</li>
        <li>Track referral activity and commissions in your dashboard</li>
        <li>Access partner resources and marketing materials</li>
        <li>View your referral codes and performance analytics</li>
      </ul>
      <p style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;font-size:14px;">
        Contact your partner manager at <a href="mailto:partners@tokenequityx.co.zw" style="color:#1A3C5E;">partners@tokenequityx.co.zw</a> if you have questions about your partnership agreement.
      </p>
      <a href="${PLATFORM}/partner" class="btn btn-gold">Go to Partner Dashboard &rarr;</a>
    `));
}

async function notifyBankingPartnerKycApproved({ bankingPartnerEmail, bankingPartnerName }) {
  const approvalDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return send(bankingPartnerEmail, `✅ KYC Approved — Banking Partner Portal Active`,
    baseTemplate('KYC Approved — Banking Partner Portal Active', `
      <p>Dear ${bankingPartnerName},</p>
      <p>Your identity verification (KYC) has been approved. Your banking partner portal on TokenEquityX is now active.</p>
      <div class="detail-row"><span>Status</span><span class="success">✔ Approved</span></div>
      <div class="detail-row"><span>Approval Date</span><span>${approvalDate}</span></div>
      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">Your Banking Partner Portal</h3>
      <ul style="color:#374151;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 20px;">
        <li>Monitor deposit and withdrawal settlement queues</li>
        <li>View and process disbursement instructions</li>
        <li>Access settlement reconciliation reports</li>
        <li>Review WHT batch submissions pending remittance</li>
      </ul>
      <p style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;font-size:14px;">
        Contact the platform administrator at <a href="mailto:admin@tokenequityx.co.zw" style="color:#1A3C5E;">admin@tokenequityx.co.zw</a> for any operational queries.
      </p>
      <a href="${PLATFORM}/banking" class="btn btn-gold">Go to Banking Partner Portal &rarr;</a>
    `));
}

async function notifyStaffKycRejected({ userEmail, userName, role, reason }) {
  const portalPath = role === 'AUDITOR' ? '/auditor' : role === 'PARTNER' ? '/partner' : '/banking';
  const portalLabel = role === 'AUDITOR' ? 'Auditor Dashboard' : role === 'PARTNER' ? 'Partner Dashboard' : 'Banking Partner Portal';
  return send(userEmail, `KYC Review — Action Required`,
    baseTemplate('KYC Review — Action Required', `
      <p>Dear ${userName},</p>
      <p>Your KYC submission could not be approved at this time. Please review the information below and resubmit your documents.</p>
      <div class="detail-row"><span>Status</span><span class="danger">✗ Not Approved</span></div>
      ${reason ? `<div class="detail-row"><span>Reason</span><span class="danger">${reason}</span></div>` : ''}
      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">How to Resubmit</h3>
      <ol style="color:#374151;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 20px;">
        <li>Review the reason noted above and gather the required documents</li>
        <li>Ensure all documents are clear, valid, and not expired</li>
        <li>Log in to your ${portalLabel} and navigate to the <strong>KYC / Verification</strong> section</li>
        <li>Resubmit your updated documents for review</li>
      </ol>
      <p style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;font-size:14px;">
        If you need assistance, contact our compliance team at <a href="mailto:compliance@tokenequityx.co.zw" style="color:#1A3C5E;">compliance@tokenequityx.co.zw</a>.
      </p>
      <a href="${PLATFORM}${portalPath}" class="btn btn-gold">Resubmit KYC &rarr;</a>
    `));
}

async function notifyInvestorP2POfferAccepted({ sellerEmail, sellerName, tokenSymbol, quantity, pricePerToken, proceeds }) {
  const fmt      = n => `$${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtPrice = n => `$${parseFloat(n || 0).toFixed(4)}`;
  return send(sellerEmail, `P2P Offer Accepted — ${tokenSymbol}`,
    baseTemplate(`P2P Offer Accepted — ${tokenSymbol}`, `
      <p>Dear ${sellerName},</p>
      <p>Your P2P sell offer for <strong>${tokenSymbol}</strong> has been accepted by a buyer. The proceeds have been credited to your wallet.</p>
      <div class="amount" style="color:#16a34a">${fmt(proceeds)}</div>
      <div class="detail-row"><span>Token Symbol</span><span style="font-family:monospace;font-weight:bold">${tokenSymbol}</span></div>
      <div class="detail-row"><span>Quantity Sold</span><span style="font-weight:700">${parseFloat(quantity || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} tokens</span></div>
      <div class="detail-row"><span>Price Per Token</span><span>${fmtPrice(pricePerToken)}</span></div>
      <div class="detail-row"><span>Gross Proceeds</span><span style="font-weight:800;color:#16a34a">${fmt(proceeds)}</span></div>
      <div class="detail-row"><span>Status</span><span class="success">✔ Credited to Wallet</span></div>
      <div class="detail-row"><span>Settlement</span><span>Within 24 hours</span></div>
      <p style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px;">
        The sale proceeds are now available in your wallet for withdrawal or reinvestment.
      </p>
      <a href="${PLATFORM}/investor" class="btn btn-gold">View Your Wallet &rarr;</a>
    `));
}

async function notifyIssuerAuditorAccepted({ issuerEmail, issuerName, tokenSymbol, entityName, referenceNumber }) {
  return send(issuerEmail, `🔍 Auditor Accepted Assignment — ${tokenSymbol}`,
    baseTemplate('Auditor Has Accepted Your Assignment', `
      <p>Dear ${issuerName},</p>
      <p>The auditor assigned to your tokenisation application for <strong>${entityName}</strong> (${tokenSymbol}) has accepted the assignment and will commence their review.</p>
      <div class="detail-row"><span>Token</span><span style="font-family:monospace;font-weight:bold">${tokenSymbol}</span></div>
      <div class="detail-row"><span>Reference</span><span style="font-family:monospace">${referenceNumber || '—'}</span></div>
      <div class="detail-row"><span>Status</span><span class="warning">⏳ Audit In Progress</span></div>
      <p style="background:#fffbeb;border-left:4px solid #d97706;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px;">
        The auditor will contact you directly to agree the scope and documentation requirements. Please have all financial records and company documents ready.
      </p>
      <a href="${PLATFORM}/issuer" class="btn btn-gold">Track Your Application &rarr;</a>
    `));
}

// ── Auditor independence declaration notifications ────────────────────────────

async function notifyAdminAuditorDeclarationSubmitted({ adminEmail, auditorName, auditorEmail, issuerName, tokenSymbol, submissionId, certificate }) {
  const html = baseTemplate('Auditor Independence Declaration Submitted', `
    <p>An auditor has submitted an independence declaration for your review.</p>
    <div class="detail-row"><span>Auditor</span><span>${auditorName} (${auditorEmail})</span></div>
    <div class="detail-row"><span>Issuer / Token</span><span>${issuerName} (${tokenSymbol})</span></div>
    <div class="detail-row"><span>Practising Certificate</span><span>${certificate}</span></div>
    <div class="detail-row"><span>Submission ID</span><span>${String(submissionId).slice(0, 8)}…</span></div>
    <p>Please log into the admin dashboard → Pipeline tab to review and approve or reject the declaration before the auditor may proceed.</p>
    <a href="${PLATFORM}/admin" class="btn">Review Declaration →</a>
  `);
  return send(adminEmail, `🗂️ Auditor Independence Declaration — ${issuerName} (${tokenSymbol})`, html);
}

async function notifyAuditorDeclarationApproved({ auditorEmail, auditorName, issuerName, tokenSymbol }) {
  const html = baseTemplate('Independence Declaration Approved', `
    <p>Dear ${auditorName},</p>
    <p>Your independence declaration for <strong>${issuerName} (${tokenSymbol})</strong> has been reviewed and <span class="success">approved</span> by the platform administrator.</p>
    <p>You may now proceed with your financial review. Please log in to the auditor portal to access the submission documents and complete your audit report.</p>
    <a href="${PLATFORM}/auditor" class="btn">Go to Auditor Portal →</a>
  `);
  return send(auditorEmail, `✅ Declaration Approved — You May Proceed: ${tokenSymbol}`, html);
}

async function notifyAuditorDeclarationRejected({ auditorEmail, auditorName, issuerName, tokenSymbol, rejectionReason }) {
  const html = baseTemplate('Independence Declaration Rejected', `
    <p>Dear ${auditorName},</p>
    <p>Your independence declaration for <strong>${issuerName} (${tokenSymbol})</strong> has been <span class="danger">rejected</span> by the platform administrator.</p>
    <div class="detail-row"><span>Reason</span><span>${rejectionReason}</span></div>
    <p>Please review the reason above and submit a revised declaration. You cannot proceed with the audit review until a declaration is approved.</p>
    <a href="${PLATFORM}/auditor" class="btn btn-gold">Resubmit Declaration →</a>
  `);
  return send(auditorEmail, `❌ Declaration Rejected — Action Required: ${tokenSymbol}`, html);
}

// ── Reconciliation notification ───────────────────────────────────────────────
// Sends a detailed fix notification to all configured reconciliation recipients.
// Returns an array of per-recipient send results for audit logging.
async function sendReconciliationEmail({ fixId, reason, changes, totalAmount, fixedByEmail, recipients, confirmedAt }) {
  const subject = `🔧 TokenEquityX Reconciliation Fix — ${fixId} — $${parseFloat(totalAmount).toFixed(2)} — ${fixedByEmail}`;

  const changesRows = changes.map(c =>
    `<div class="detail-row"><span>Deposit ${String(c.id).slice(0, 8)}… ($${parseFloat(c.amount_usd).toFixed(2)})</span><span class="danger">→ VOIDED</span></div>`
  ).join('');

  const html = baseTemplate('Reconciliation Adjustment Notification', `
    <p>A reconciliation fix has been applied to the TokenEquityX platform ledger. Review the details below and contact the platform team if you have concerns.</p>
    <div class="detail-row"><span>Fix Type</span><span>${fixId}</span></div>
    <div class="detail-row"><span>Total Adjusted</span><span class="danger">$${parseFloat(totalAmount).toFixed(2)}</span></div>
    <div class="detail-row"><span>Records Affected</span><span>${changes.length}</span></div>
    <div class="detail-row"><span>Performed By</span><span>${fixedByEmail}</span></div>
    <div class="detail-row"><span>Timestamp</span><span>${confirmedAt}</span></div>
    <div class="detail-row"><span>Reason</span><span>${reason}</span></div>
    <h3 style="margin:20px 0 8px;font-size:14px;color:#374151;">Affected Records</h3>
    ${changesRows || '<p style="color:#6b7280;font-size:13px;">No records listed.</p>'}
    <p style="margin-top:20px;font-size:13px;color:#6b7280;">
      Notification sent to: ${recipients.join(', ')}
    </p>
  `);

  const results = [];
  for (const recipient of recipients) {
    try {
      const result = await send(recipient, subject, html);
      results.push({ email: recipient, success: !result?.error, error: result?.error || null });
    } catch (e) {
      results.push({ email: recipient, success: false, error: e.message });
    }
  }
  return results;
}

async function sendEscalationNotification({ submissionId, tokenSymbol, pricePerToken, issuerValuation, variance, reason }) {
  const resend = getResend();
  if (!resend) return;
  const html = baseTemplate('⚠️ Valuation Escalation — SECZ Review Required', `
    <p>A data submission has been automatically escalated due to a valuation variance exceeding 30%.</p>
    <div class="detail-row"><span>Token</span><span>${tokenSymbol}</span></div>
    <div class="detail-row"><span>Submission ID</span><span>${submissionId}</span></div>
    <div class="detail-row"><span>Auditor Price</span><span class="warning">$${Number(pricePerToken).toFixed(4)}</span></div>
    <div class="detail-row"><span>Issuer Valuation</span><span>$${Number(issuerValuation).toFixed(4)}</span></div>
    <div class="detail-row"><span>Variance</span><span class="danger">${(Number(variance) * 100).toFixed(1)}%</span></div>
    <p style="margin-top:16px;font-size:13px;color:#6b7280;">${reason}</p>
    <p>Log in to the admin panel to override or request resubmission from the issuer.</p>
    <a href="${PLATFORM}/admin" class="btn btn-gold">Review in Admin Panel →</a>
  `);
  return resend.emails.send({
    from:    FROM,
    to:      [ADMIN],
    subject: `[SECZ] Valuation Escalation — ${tokenSymbol} (${(Number(variance) * 100).toFixed(1)}% variance)`,
    html,
  });
}

async function sendIntegrityCheckAlert(report) {
  const resend = getResend();
  if (!resend) return;
  const issues = report.checks.filter(c => c.status !== 'OK');
  const rows = issues.map(c =>
    `<div class="detail-row"><span>${c.label}</span><span class="${c.status === 'FAIL' ? 'danger' : 'warning'}">${c.status}${c.count > 0 ? ` (${c.count})` : ''}</span></div>`
  ).join('');
  const html = baseTemplate('⚠️ Platform Integrity Alert', `
    <p>The weekly integrity check found <strong>${issues.length} issue(s)</strong> requiring attention.</p>
    <div class="detail-row"><span>Overall Status</span><span class="${report.overallStatus === 'FAIL' ? 'danger' : 'warning'}">${report.overallStatus}</span></div>
    <div class="detail-row"><span>Checks run</span><span>${report.summary.total}</span></div>
    ${rows}
    <a href="${PLATFORM}/admin" class="btn" style="margin-top:20px">Review in Admin Panel →</a>
  `);
  return resend.emails.send({
    from:    FROM,
    to:      [ADMIN],
    subject: `[Platform] Integrity check — ${report.overallStatus} (${issues.length} issue${issues.length !== 1 ? 's' : ''})`,
    html,
  });
}

// ── USDC Supervised Pilot email templates (SI 99 of 2026) ──────────────────

async function notifyUsdcDepositInitiated({ investorEmail, investorName, amount, txHash, omnibusWallet, depositId }) {
  if (!investorEmail) return;
  return send(investorEmail, `USDC Deposit Received — ${amount.toFixed(2)} USDC`,
    baseTemplate('USDC Deposit Received', `
      <p>Dear ${investorName},</p>
      <p>Your USDC deposit has been received and is pending admin verification on Polygon PoS.</p>
      <div class="detail-row"><span>Amount</span><span>${amount.toFixed(2)} USDC</span></div>
      <div class="detail-row"><span>Transaction Hash</span><span style="font-family:monospace;font-size:12px;">${txHash}</span></div>
      ${omnibusWallet ? `<div class="detail-row"><span>Omnibus Wallet</span><span style="font-family:monospace;font-size:12px;">${omnibusWallet.slice(0,8)}…${omnibusWallet.slice(-6)}</span></div>` : ''}
      <div class="detail-row"><span>Deposit ID</span><span>${depositId}</span></div>
      <p style="margin-top:16px;font-size:13px;color:#6b7280;">Your balance will be credited within 4 business hours once the on-chain transaction is verified.</p>
      <p style="font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:16px;">This transaction is processed under the TokenEquityX USDC Supervised Pilot in accordance with Statutory Instrument 99 of 2026.</p>
      <a href="${PLATFORM}/investor" class="btn btn-gold">View Your Wallet &rarr;</a>
    `));
}

async function notifyUsdcDepositConfirmed({ investorEmail, investorName, amount, depositId }) {
  if (!investorEmail) return;
  return send(investorEmail, `USDC Deposit Confirmed — ${amount.toFixed(2)} USDC`,
    baseTemplate('USDC Deposit Confirmed', `
      <p>Dear ${investorName},</p>
      <p>Your USDC deposit has been verified and credited to your wallet.</p>
      <div class="detail-row"><span>Amount Credited</span><span class="success">${amount.toFixed(2)} USDC</span></div>
      <div class="detail-row"><span>Deposit ID</span><span>${depositId}</span></div>
      <a href="${PLATFORM}/investor" class="btn btn-gold">View Your Wallet &rarr;</a>
    `));
}

async function notifyUsdcWithdrawalInitiated({ investorEmail, investorName, amount, netAmount, imttAmount, imttRate, isResident, destinationWallet, withdrawalId }) {
  if (!investorEmail) return;
  const imttLine = isResident
    ? `<div class="detail-row"><span>IMTT Withheld (${(imttRate*100).toFixed(0)}%)</span><span class="warning">${imttAmount.toFixed(6)} USDC</span></div>`
    : `<div class="detail-row"><span>IMTT</span><span>Not applicable (international investor)</span></div>`;
  return send(investorEmail, `USDC Withdrawal Requested — ${amount.toFixed(2)} USDC`,
    baseTemplate('USDC Withdrawal Requested', `
      <p>Dear ${investorName},</p>
      <p>Your USDC withdrawal request has been received and will be processed within 1 business day.</p>
      <div class="detail-row"><span>Requested</span><span>${amount.toFixed(2)} USDC</span></div>
      ${imttLine}
      <div class="detail-row"><span>Net to Wallet</span><span>${netAmount.toFixed(6)} USDC</span></div>
      <div class="detail-row"><span>Destination</span><span style="font-family:monospace;font-size:12px;">${destinationWallet.slice(0,8)}…${destinationWallet.slice(-6)}</span></div>
      <div class="detail-row"><span>Withdrawal ID</span><span>${withdrawalId}</span></div>
      <p style="font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:16px;">This transaction is processed under the TokenEquityX USDC Supervised Pilot in accordance with Statutory Instrument 99 of 2026.</p>
    `));
}

async function notifyUsdcWithdrawalCompleted({ investorEmail, investorName, netAmount, txHash, destinationWallet, withdrawalId }) {
  if (!investorEmail) return;
  return send(investorEmail, `USDC Withdrawal Completed — ${netAmount.toFixed(6)} USDC`,
    baseTemplate('USDC Withdrawal Completed', `
      <p>Dear ${investorName},</p>
      <p>Your USDC withdrawal has been processed on Polygon PoS.</p>
      <div class="detail-row"><span>Amount Sent</span><span class="success">${netAmount.toFixed(6)} USDC</span></div>
      ${txHash ? `<div class="detail-row"><span>Transaction Hash</span><span style="font-family:monospace;font-size:12px;">${txHash}</span></div>` : ''}
      <div class="detail-row"><span>Destination</span><span style="font-family:monospace;font-size:12px;">${destinationWallet.slice(0,8)}…${destinationWallet.slice(-6)}</span></div>
      <div class="detail-row"><span>Withdrawal ID</span><span>${withdrawalId}</span></div>
      <a href="${PLATFORM}/investor" class="btn btn-gold">View Transaction History &rarr;</a>
    `));
}

async function notifyUsdcPilotSuspended({ investorEmail, investorName, balanceUsdc, suspendedAt }) {
  const resend = getResend();
  if (!resend) return;
  const html = baseTemplate('USDC Pilot Suspended — Action Required', `
    <p>Dear ${investorName || 'Investor'},</p>
    <p>The TokenEquityX USDC supervised pilot under <strong>Statutory Instrument 99 of 2026</strong> has been temporarily suspended by platform administration.</p>
    <div class="detail-row"><span>Your USDC Balance</span><span>${Number(balanceUsdc || 0).toFixed(6)} USDC</span></div>
    <div class="detail-row"><span>Suspended At</span><span>${new Date(suspendedAt || Date.now()).toLocaleString('en-GB', { timeZone: 'Africa/Harare' })} (CAT)</span></div>
    <p style="margin-top:16px;">Your funds are safe and remain in the platform ledger. You will not be able to make new USDC deposits or withdrawals until the pilot is re-activated following regulatory confirmation.</p>
    <p>Our team will contact you with further information as soon as the situation is resolved. If you have questions please contact <a href="mailto:${ADMIN}">${ADMIN}</a>.</p>
    <a href="${PLATFORM}/investor" class="btn btn-gold">View Your Portfolio &rarr;</a>
  `);
  return resend.emails.send({
    from:    FROM,
    to:      [investorEmail],
    subject: '[TokenEquityX] USDC Pilot Suspended — Your Balance is Safe',
    html,
  });
}

async function notifyUsdcMonthlyReport(report) {
  const resend = getResend();
  if (!resend) return;
  const html = baseTemplate('Monthly USDC Pilot Report — RBZ Submission', `
    <p>TokenEquityX monthly USDC supervised pilot report for RBZ submission.</p>
    <div class="detail-row"><span>Period</span><span>${report.period_year}-${String(report.period_month).padStart(2,'0')}</span></div>
    <div class="detail-row"><span>Regulatory Basis</span><span>${report.regulatory_basis}</span></div>
    <div class="detail-row"><span>Deposits (count)</span><span>${report.deposits.count}</span></div>
    <div class="detail-row"><span>Deposits (total)</span><span>${report.deposits.total_usdc.toFixed(2)} USDC</span></div>
    <div class="detail-row"><span>Withdrawals (count)</span><span>${report.withdrawals.count}</span></div>
    <div class="detail-row"><span>Withdrawals (total)</span><span>${report.withdrawals.total_usdc.toFixed(2)} USDC</span></div>
    <div class="detail-row"><span>IMTT Collected</span><span>${report.withdrawals.imtt_collected.toFixed(6)} USDC</span></div>
    <div class="detail-row"><span>Active Investors</span><span>${report.active_investors}</span></div>
    <div class="detail-row"><span>Ledger Total (USDC)</span><span>${report.current_ledger_total_usdc.toFixed(6)} USDC</span></div>
    ${report.latest_reconciliation ? `<div class="detail-row"><span>Last Recon Status</span><span>${report.latest_reconciliation.status}</span></div>` : ''}
    <p style="margin-top:16px;font-size:13px;">Please review and forward to the Reserve Bank of Zimbabwe as required under SI 99 of 2026.</p>
    <a href="${PLATFORM}/admin" class="btn btn-gold">Download Full Report &rarr;</a>
  `);
  return resend.emails.send({
    from:    FROM,
    to:      [ADMIN],
    subject: `[RBZ Report] USDC Pilot — ${report.period_year}-${String(report.period_month).padStart(2,'0')}`,
    html,
  });
}

async function notifySuspiciousActivityReport({ cddId, investorEmail, investorName, transactionType, amountUsd, triggeredAt, reviewerNotes }) {
  const resend = getResend();
  if (!resend) return;
  const complianceEmail = process.env.COMPLIANCE_EMAIL || process.env.ADMIN_EMAIL;
  if (!complianceEmail) return;
  const html = baseTemplate('Suspicious Activity Report — CDD Flagged', `
    <p style="color:#c0392b;font-weight:bold;">⚠️ A CDD check has been flagged for Suspicious Activity Review.</p>
    <p>This notification is generated automatically under SI 99 of 2026, Section 21(5).<br>
    A Suspicious Transaction Report (STR) must be filed with the Financial Intelligence Unit (FIU) if warranted.</p>
    <table style="border-collapse:collapse;width:100%;margin:16px 0;">
      <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:bold;">CDD Check ID</td><td style="padding:6px 12px;">${cddId}</td></tr>
      <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:bold;">Investor</td><td style="padding:6px 12px;">${investorName || 'Unknown'} &lt;${investorEmail || ''}&gt;</td></tr>
      <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:bold;">Transaction Type</td><td style="padding:6px 12px;">${transactionType}</td></tr>
      <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:bold;">Amount (USD)</td><td style="padding:6px 12px;">$${parseFloat(amountUsd || 0).toFixed(2)}</td></tr>
      <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:bold;">Triggered At</td><td style="padding:6px 12px;">${triggeredAt}</td></tr>
      <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:bold;">Reviewer Notes</td><td style="padding:6px 12px;">${reviewerNotes || '—'}</td></tr>
    </table>
    <p>Log into the admin panel to review the full transaction history and KYC record before filing an STR.</p>
    <p style="font-size:12px;color:#888;">Regulatory basis: SI 99 of 2026 — Money Laundering and Proceeds of Crime (VASP Registration) Regulations, 2026. Administered by the Financial Intelligence Unit (FIU), Reserve Bank of Zimbabwe.</p>
  `);
  await resend.emails.send({
    from:    process.env.EMAIL_FROM || 'TokenEquityX <noreply@tokenequityx.com>',
    to:      complianceEmail,
    subject: `[SAR ALERT] CDD Flagged — ${investorName || investorEmail} — $${parseFloat(amountUsd || 0).toFixed(2)} ${transactionType}`,
    html,
  });
}

// ── notifyOfferingPublicPhaseOpen — sent to all KYC-approved investors when anchor phase ends
async function notifyOfferingPublicPhaseOpen({ investors, tokenName, tokenSymbol, assetType, priceUsd, retailMinUsd, closeDate, offeringId }) {
  const resend = getResend();
  if (!resend || !Array.isArray(investors) || investors.length === 0) return;
  const closeFmt  = closeDate ? new Date(closeDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const minFmt    = retailMinUsd ? `$${parseFloat(retailMinUsd).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '$100.00';
  const priceFmt  = priceUsd ? `$${parseFloat(priceUsd).toFixed(4)}` : '—';
  const results   = await Promise.allSettled(investors.map(({ email, name }) => {
    const html = baseTemplate(`${tokenSymbol} Primary Offering — Now Open to All Investors`, `
      <p>Dear ${name || 'Investor'},</p>
      <p>A primary offering is now open for public subscription on TokenEquityX.</p>
      <div class="amount" style="color:#1A3C5E">${tokenName} (${tokenSymbol})</div>
      <div class="detail-row"><span>Asset Type</span><span>${assetType || '—'}</span></div>
      <div class="detail-row"><span>Offering Price</span><span style="font-weight:700">${priceFmt} per token</span></div>
      <div class="detail-row"><span>Minimum Investment</span><span>${minFmt}</span></div>
      <div class="detail-row"><span>Subscription Closes</span><span>${closeFmt}</span></div>
      <p style="background:#fffbeb;border-left:4px solid #d97706;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px;">
        <strong>Action required:</strong> Log in to your TokenEquityX investor dashboard to review the offering and subscribe before the deadline.
      </p>
      <p style="font-size:12px;color:#666;">Investments in primary market tokenised securities are illiquid and carry risk. This is not financial advice.</p>
      <a href="${PLATFORM}/investor/offering/${offeringId}" class="btn btn-gold">View Offering &rarr;</a>
    `);
    return resend.emails.send({
      from:    process.env.EMAIL_FROM || 'TokenEquityX <noreply@tokenequityx.com>',
      to:      email,
      subject: `📢 ${tokenSymbol} Primary Offering Open — Min ${minFmt} — Closes ${closeFmt}`,
      html,
    });
  }));
  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length) console.error(`[MAILER] notifyOfferingPublicPhaseOpen: ${failed.length}/${investors.length} emails failed`);
}

// ── notifySubscriptionConfirmedPrimary — richer confirmation with fee breakdown
async function notifySubscriptionConfirmedPrimary({ investorEmail, investorName, tokenName, tokenSymbol, quantity, pricePerToken, amountUsd, issuanceFeeUsd, deadline }) {
  const deadlineFmt = deadline ? new Date(deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const priceFmt    = pricePerToken ? `$${parseFloat(pricePerToken).toFixed(4)}` : '—';
  const feeFmt      = issuanceFeeUsd ? `$${parseFloat(issuanceFeeUsd).toFixed(2)}` : '—';
  return send(investorEmail, `✅ Primary Subscription Confirmed — ${tokenSymbol}`,
    baseTemplate('Primary Offering Subscription Confirmed', `
      <p>Dear ${investorName},</p>
      <p>Your subscription to the <strong>${tokenName} (${tokenSymbol})</strong> primary offering has been confirmed and your wallet has been debited.</p>
      <div class="amount" style="color:#1A3C5E">$${parseFloat(amountUsd).toFixed(2)} USD</div>
      <div class="detail-row"><span>Token</span><span style="font-family:monospace;font-weight:bold">${tokenSymbol}</span></div>
      <div class="detail-row"><span>Tokens Reserved</span><span style="font-weight:700">${parseInt(quantity).toLocaleString()} tokens</span></div>
      <div class="detail-row"><span>Price Per Token</span><span>${priceFmt}</span></div>
      <div class="detail-row"><span>Issuance Fee</span><span>${feeFmt} (charged to issuer)</span></div>
      <div class="detail-row"><span>Status</span><span class="success">✔ Confirmed</span></div>
      <div class="detail-row"><span>Offering Closes</span><span>${deadlineFmt}</span></div>
      <p style="background:#fffbeb;border-left:4px solid #d97706;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px;">
        <strong>Next step:</strong> Your tokens will be credited to your portfolio automatically once the offering closes and receives final platform approval. No further action is required.
      </p>
      <p style="font-size:12px;color:#666;">Keep this email as confirmation of your subscription. For queries, contact support@tokenequityx.com.</p>
      <a href="${PLATFORM}/investor" class="btn btn-gold">View Your Portfolio &rarr;</a>
    `));
}

// ── notifyAnchorPhaseOpen — sent to INSTITUTIONAL (Tier 3) investors when an offering with anchor phase is approved
async function notifyAnchorPhaseOpen({ institutionEmail, institutionName, tokenName, tokenSymbol, assetType, priceUsd, institutionalMinUsd, anchorPhaseEndDate, offeringId }) {
  const anchorFmt = anchorPhaseEndDate ? new Date(anchorPhaseEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const priceFmt  = priceUsd ? `$${parseFloat(priceUsd).toFixed(4)}` : '—';
  const minFmt    = institutionalMinUsd ? `$${parseFloat(institutionalMinUsd).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '$10,000.00';
  return send(institutionEmail, `🏦 Institutional Anchor Phase Open — ${tokenSymbol}`,
    baseTemplate('Anchor Phase — Early Institutional Access', `
      <p>Dear ${institutionName || 'Institutional Investor'},</p>
      <p>As a verified institutional investor on TokenEquityX, you have been granted <strong>early anchor access</strong> to the following primary offering before it opens to retail investors.</p>
      <div class="amount" style="color:#1A3C5E">${tokenName} (${tokenSymbol})</div>
      <div class="detail-row"><span>Asset Type</span><span>${assetType || '—'}</span></div>
      <div class="detail-row"><span>Offering Price</span><span style="font-weight:700">${priceFmt} per token</span></div>
      <div class="detail-row"><span>Institutional Minimum</span><span>${minFmt}</span></div>
      <div class="detail-row"><span>Anchor Phase Closes</span><span style="font-weight:700;color:#d97706">${anchorFmt}</span></div>
      <p style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;font-size:14px;margin-top:16px;">
        <strong>Exclusive access:</strong> The public subscription phase opens ${anchorFmt}. Subscribe now to secure your position before retail investors can participate.
      </p>
      <p style="font-size:12px;color:#666;">This invitation is exclusive to verified institutional investors. Investments are subject to the terms in the offering documents.</p>
      <a href="${PLATFORM}/investor/offering/${offeringId}" class="btn btn-gold">View Offering &rarr;</a>
    `));
}

// ── ZIMRA WHT QUARTERLY REPORT ─────────────────────────────────────────────────
async function notifyZimraWHTQuarterlyReport(whtReturn, csv, dueDate) {
  const resend = getResend();
  if (!resend) return;
  const to = process.env.COMPLIANCE_EMAIL || process.env.ADMIN_EMAIL;
  if (!to) return;

  const dueFmt    = dueDate instanceof Date
    ? dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : String(dueDate);
  const daysLeft  = dueDate instanceof Date
    ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const dueBadge  = daysLeft !== null && daysLeft <= 10
    ? `<span style="color:#dc2626;font-weight:bold;">${dueFmt} — ${daysLeft} days remaining!</span>`
    : `<span>${dueFmt}</span>`;

  const totalFmt  = `USD ${parseFloat(whtReturn.totals.totalWHT).toFixed(2)}`;
  const html = baseTemplate(`ZIMRA WHT Return — ${whtReturn.quarter}`, `
    <p>Dear Compliance Officer,</p>
    <p>The quarterly ZIMRA Withholding Tax return for <strong>${whtReturn.quarter}</strong> has been generated automatically. Please file via ZIMRA e-services and update the platform once filed.</p>

    <table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:14px;">
      <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;width:40%">Quarter</td><td style="padding:8px 12px;">${whtReturn.quarter}</td></tr>
      <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">Period</td><td style="padding:8px 12px;">${whtReturn.periodStart} to ${whtReturn.periodEnd}</td></tr>
      <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">Due Date</td><td style="padding:8px 12px;">${dueBadge}</td></tr>
      <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">Total WHT</td><td style="padding:8px 12px;font-weight:bold;font-size:16px;">${totalFmt}</td></tr>
      <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">&#8194;Resident WHT (10%)</td><td style="padding:8px 12px;">USD ${parseFloat(whtReturn.totals.residentWHT).toFixed(2)}</td></tr>
      <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">&#8194;Non-Resident WHT (15%)</td><td style="padding:8px 12px;">USD ${parseFloat(whtReturn.totals.nonResidentWHT).toFixed(2)}</td></tr>
      <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">Distributions</td><td style="padding:8px 12px;">${whtReturn.distributionCount}</td></tr>
      <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">Investors</td><td style="padding:8px 12px;">${whtReturn.investorCount}</td></tr>
    </table>

    <div style="background:#fefce8;border-left:4px solid #ca8a04;padding:14px 16px;border-radius:4px;font-size:14px;margin:16px 0;">
      <p style="margin:0 0 8px;font-weight:bold;">Filing Instructions — ITF12C (WHT on Dividends)</p>
      <ol style="margin:0;padding-left:20px;line-height:1.8;">
        <li>Log into ZIMRA e-services: <a href="https://www.my.zimra.co.zw" style="color:#1d4ed8;">www.my.zimra.co.zw</a></li>
        <li>Select: <strong>Returns → Withholding Tax → Dividends (ITF12C)</strong></li>
        <li>Enter the figures above for the period ${whtReturn.periodStart} to ${whtReturn.periodEnd}</li>
        <li>Attach the CSV file included with this email for line-item backup</li>
        <li>Submit and note your <strong>ZIMRA reference number</strong></li>
        <li>Make payment via your bank using the ZIMRA reference</li>
        <li>Log the reference in TokenEquityX admin: <strong>Admin → WHT Remittance → ${whtReturn.quarter} → Mark Filed / Mark Paid</strong></li>
      </ol>
    </div>

    <p style="font-size:12px;color:#888;">This report was auto-generated by TokenEquityX. Retain all records for a minimum of 5 years per the Income Tax Act [Chapter 23:06]. The CSV attachment contains full line-item detail for each investor.</p>
  `);

  const filename = `TokenEquityX_WHT_${whtReturn.quarter}.csv`;
  await resend.emails.send({
    from:        process.env.EMAIL_FROM || 'TokenEquityX <noreply@tokenequityx.com>',
    to,
    subject:     `📊 ZIMRA WHT Return — ${whtReturn.quarter} — ${totalFmt} — Due ${dueFmt}`,
    html,
    attachments: [{ filename, content: Buffer.from(csv).toString('base64') }],
  });
}

// ── ZIMRA WHT OVERDUE ALERT ────────────────────────────────────────────────────
async function notifyZimraWHTOverdue({ quarter, dueDate, daysOverdue, totalWHT, residentWHT, nonResidentWHT }) {
  const resend = getResend();
  if (!resend) return;
  const to = process.env.COMPLIANCE_EMAIL || process.env.ADMIN_EMAIL;
  if (!to) return;

  const dueFmt   = dueDate ? new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : String(dueDate);
  const totalFmt = `USD ${parseFloat(totalWHT).toFixed(2)}`;
  const html = baseTemplate(`⚠️ OVERDUE — ZIMRA WHT ${quarter}`, `
    <p style="color:#dc2626;font-weight:bold;font-size:16px;">⚠️ ZIMRA WHT remittance is overdue.</p>
    <p>The WHT return for <strong>${quarter}</strong> has not been marked as paid. Late payments attract interest and penalties under the Income Tax Act [Chapter 23:06].</p>

    <table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:14px;">
      <tr><td style="padding:8px 12px;background:#fef2f2;font-weight:bold;width:40%">Quarter</td><td style="padding:8px 12px;font-weight:bold;">${quarter}</td></tr>
      <tr><td style="padding:8px 12px;background:#fef2f2;font-weight:bold;">Original Due Date</td><td style="padding:8px 12px;color:#dc2626;font-weight:bold;">${dueFmt}</td></tr>
      <tr><td style="padding:8px 12px;background:#fef2f2;font-weight:bold;">Days Overdue</td><td style="padding:8px 12px;color:#dc2626;font-weight:bold;">${daysOverdue} days</td></tr>
      <tr><td style="padding:8px 12px;background:#fef2f2;font-weight:bold;">Total WHT Outstanding</td><td style="padding:8px 12px;font-weight:bold;font-size:16px;">${totalFmt}</td></tr>
      <tr><td style="padding:8px 12px;background:#fef2f2;font-weight:bold;">Resident WHT</td><td style="padding:8px 12px;">USD ${parseFloat(residentWHT || 0).toFixed(2)}</td></tr>
      <tr><td style="padding:8px 12px;background:#fef2f2;font-weight:bold;">Non-Resident WHT</td><td style="padding:8px 12px;">USD ${parseFloat(nonResidentWHT || 0).toFixed(2)}</td></tr>
    </table>

    <p style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;font-size:14px;margin:16px 0;">
      <strong>Immediate action required.</strong> File and pay via <a href="https://www.my.zimra.co.zw" style="color:#dc2626;">www.my.zimra.co.zw</a> and update the TokenEquityX admin dashboard: <strong>Admin → WHT Remittance → ${quarter}</strong>.
    </p>
    <p style="font-size:12px;color:#888;">Late WHT payments attract statutory interest at the prescribed rate plus a penalty under the Income Tax Act. Contact ZIMRA directly if filing a late return.</p>
    <a href="${PLATFORM}/admin" class="btn" style="background:#dc2626;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Go to WHT Dashboard &rarr;</a>
  `);

  await resend.emails.send({
    from:    process.env.EMAIL_FROM || 'TokenEquityX <noreply@tokenequityx.com>',
    to,
    subject: `⚠️ OVERDUE — ZIMRA WHT ${quarter} — ${daysOverdue} days late — ${totalFmt}`,
    html,
  });
}

// ── ZIMRA WHT FILED CONFIRMATION ───────────────────────────────────────────────
async function notifyZimraWHTFiled({ quarter, zimraReference, totalWHT, notes }) {
  const resend = getResend();
  if (!resend) return;
  const to = process.env.COMPLIANCE_EMAIL || process.env.ADMIN_EMAIL;
  if (!to) return;

  const html = baseTemplate(`✅ ZIMRA WHT Filed — ${quarter}`, `
    <p>Dear Compliance Officer,</p>
    <p>The ZIMRA Withholding Tax return for <strong>${quarter}</strong> has been marked as <span class="success">FILED</span>.</p>

    <table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:14px;">
      <tr><td style="padding:8px 12px;background:#f0fdf4;font-weight:bold;width:40%">Quarter</td><td style="padding:8px 12px;">${quarter}</td></tr>
      <tr><td style="padding:8px 12px;background:#f0fdf4;font-weight:bold;">ZIMRA Reference</td><td style="padding:8px 12px;font-family:monospace;font-weight:bold;">${zimraReference}</td></tr>
      <tr><td style="padding:8px 12px;background:#f0fdf4;font-weight:bold;">Total WHT Filed</td><td style="padding:8px 12px;font-weight:bold;">USD ${parseFloat(totalWHT || 0).toFixed(2)}</td></tr>
      ${notes ? `<tr><td style="padding:8px 12px;background:#f0fdf4;font-weight:bold;">Notes</td><td style="padding:8px 12px;">${notes}</td></tr>` : ''}
    </table>

    <p>Next step: make the bank payment using ZIMRA reference <strong>${zimraReference}</strong> and then mark the return as PAID in the TokenEquityX admin dashboard.</p>
    <p style="font-size:12px;color:#888;">Retain the ZIMRA acknowledgement of receipt for your records (minimum 5 years).</p>
  `);

  await resend.emails.send({
    from:    process.env.EMAIL_FROM || 'TokenEquityX <noreply@tokenequityx.com>',
    to,
    subject: `✅ ZIMRA WHT Filed — ${quarter} — Ref: ${zimraReference}`,
    html,
  });
}

// ── ZIMRA WHT PAID CONFIRMATION ────────────────────────────────────────────────
async function notifyZimraWHTPaid({ quarter, zimraReference, bankReference, paymentDate, totalWHT, notes }) {
  const resend = getResend();
  if (!resend) return;
  const to = process.env.COMPLIANCE_EMAIL || process.env.ADMIN_EMAIL;
  if (!to) return;

  const dateFmt = paymentDate
    ? new Date(paymentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : String(paymentDate);
  const html = baseTemplate(`✅ ZIMRA WHT Paid — ${quarter}`, `
    <p>Dear Compliance Officer,</p>
    <p>The ZIMRA Withholding Tax payment for <strong>${quarter}</strong> has been recorded as <span class="success">PAID</span>.</p>

    <table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:14px;">
      <tr><td style="padding:8px 12px;background:#f0fdf4;font-weight:bold;width:40%">Quarter</td><td style="padding:8px 12px;">${quarter}</td></tr>
      <tr><td style="padding:8px 12px;background:#f0fdf4;font-weight:bold;">ZIMRA Reference</td><td style="padding:8px 12px;font-family:monospace;">${zimraReference || '—'}</td></tr>
      <tr><td style="padding:8px 12px;background:#f0fdf4;font-weight:bold;">Bank Reference</td><td style="padding:8px 12px;font-family:monospace;font-weight:bold;">${bankReference}</td></tr>
      <tr><td style="padding:8px 12px;background:#f0fdf4;font-weight:bold;">Payment Date</td><td style="padding:8px 12px;">${dateFmt}</td></tr>
      <tr><td style="padding:8px 12px;background:#f0fdf4;font-weight:bold;">Amount Paid</td><td style="padding:8px 12px;font-weight:bold;">USD ${parseFloat(totalWHT || 0).toFixed(2)}</td></tr>
      ${notes ? `<tr><td style="padding:8px 12px;background:#f0fdf4;font-weight:bold;">Notes</td><td style="padding:8px 12px;">${notes}</td></tr>` : ''}
    </table>

    <p style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;font-size:14px;margin:16px 0;">
      WHT remittance for ${quarter} is now complete. Retain the ZIMRA payment receipt and bank confirmation for a minimum of 5 years.
    </p>
    <p style="font-size:12px;color:#888;">Income Tax Act [Chapter 23:06] — WHT on dividends and distributions. Regulated by ZIMRA.</p>
  `);

  await resend.emails.send({
    from:    process.env.EMAIL_FROM || 'TokenEquityX <noreply@tokenequityx.com>',
    to,
    subject: `✅ ZIMRA WHT Paid — ${quarter} — Bank Ref: ${bankReference}`,
    html,
  });
}

// ── Existing Position Conversion emails (Task 7) ────────────────────────────

async function notifyConversionSubmitted({
  investorEmail, investorName, tokenSymbol, tokenName,
  referenceNumber, jurisdiction, positionValue, needsLenderConsent, applicationStatus,
}) {
  const valFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(positionValue || 0);
  return send(investorEmail, `✅ Conversion Request Received — ${tokenSymbol}`,
    baseTemplate('Existing Position Conversion — Request Received', `
      <p>Dear ${investorName},</p>
      <p>Your request to convert an existing position into tokenised form has been received and is now under review by the TokenEquityX team.</p>
      <div class="detail-row"><span>Reference</span><span class="mono">${referenceNumber}</span></div>
      <div class="detail-row"><span>Token Symbol</span><span><strong>${tokenSymbol}</strong></span></div>
      <div class="detail-row"><span>Token Name</span><span>${tokenName}</span></div>
      <div class="detail-row"><span>Jurisdiction</span><span>${jurisdiction}</span></div>
      <div class="detail-row"><span>Declared Position Value</span><span>${valFmt}</span></div>
      <div class="detail-row"><span>Status</span><span class="${applicationStatus === 'AWAITING_LENDER_CONSENT' ? 'warning' : 'success'}">${applicationStatus === 'AWAITING_LENDER_CONSENT' ? '⏳ Awaiting Lender Consent' : '🔍 Under Review'}</span></div>
      ${needsLenderConsent && applicationStatus === 'AWAITING_LENDER_CONSENT' ? `
      <p style="background:#fef2f2;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;font-size:14px;margin:20px 0;">
        <strong>Action Required:</strong> Your application is on hold pending written lender consent. Please upload the signed consent document via your dashboard or contact your account manager.
      </p>` : ''}
      <p>Our team will review your documents and contact you within 5 business days. You can track the status of your request in your investor dashboard.</p>
      <a href="${PLATFORM}/investor/convert-position" class="btn btn-gold">Track Your Request &rarr;</a>
    `));
}

async function notifyConversionLenderConsentRequired({
  investorEmail, investorName, tokenSymbol, referenceNumber, notes,
}) {
  return send(investorEmail, `Action Required — Lender Consent Needed for ${tokenSymbol}`,
    baseTemplate('Lender Consent Required — Action Required', `
      <p>Dear ${investorName},</p>
      <p>Your existing position conversion request for <strong>${tokenSymbol}</strong> requires written consent from your lender or creditor before it can proceed. This is a standard requirement where a position is subject to a security interest or covenant restricting transfer.</p>
      <div class="detail-row"><span>Reference</span><span class="mono">${referenceNumber}</span></div>
      <div class="detail-row"><span>Token Symbol</span><span><strong>${tokenSymbol}</strong></span></div>
      <div class="detail-row"><span>Status</span><span class="warning">⏳ Awaiting Lender Consent</span></div>
      ${notes ? `<div class="detail-row"><span>Notes from Review Team</span><span>${notes}</span></div>` : ''}
      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">What You Need to Do</h3>
      <ol style="color:#374151;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 20px;">
        <li>Obtain a letter of consent from your lender approving the transfer of the position into the SPV structure</li>
        <li>Ensure the letter is signed by an authorised representative and clearly references the position and SPV</li>
        <li>Upload the signed consent document via the portal or email it to <a href="mailto:compliance@tokenequityx.co.zw" style="color:#1A3C5E;">compliance@tokenequityx.co.zw</a> with your reference number</li>
      </ol>
      <p style="background:#fef2f2;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;font-size:14px;">
        Your application will remain on hold until the lender consent document is received and verified. There is no time limit, but the position cannot be tokenised without this document.
      </p>
      <a href="${PLATFORM}/investor/convert-position" class="btn btn-gold">Upload Consent Document &rarr;</a>
    `));
}

async function notifyConversionApprovedTokensMinted({
  investorEmail, investorName, tokenSymbol, tokenName,
  totalSupply, priceUsd, lockupEndDate, referenceNumber,
}) {
  const lockFmt = lockupEndDate ? new Date(lockupEndDate).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : '—';
  const priceFmt = parseFloat(priceUsd || 0).toFixed(4);
  const totalVal = (parseFloat(priceUsd || 0) * parseInt(totalSupply || 0)).toLocaleString('en-US', { style:'currency', currency:'USD' });
  return send(investorEmail, `🎉 Tokens Minted — ${tokenSymbol} is Now Live`,
    baseTemplate(`Your ${tokenSymbol} Tokens Are Live`, `
      <p>Dear ${investorName},</p>
      <p>Congratulations! Your existing position conversion for <strong>${tokenSymbol} (${tokenName})</strong> has been approved and your tokens have been minted directly to your portfolio.</p>
      <div class="detail-row"><span>Token Symbol</span><span><strong>${tokenSymbol}</strong></span></div>
      <div class="detail-row"><span>Tokens Minted</span><span><strong>${parseInt(totalSupply || 0).toLocaleString()}</strong></span></div>
      <div class="detail-row"><span>Initial Price per Token</span><span>$${priceFmt}</span></div>
      <div class="detail-row"><span>Total Position Value</span><span>${totalVal}</span></div>
      <div class="detail-row"><span>Reference</span><span class="mono">${referenceNumber}</span></div>
      <div class="detail-row"><span>Lockup Ends</span><span class="warning"><strong>${lockFmt}</strong></span></div>
      <p style="background:#fef2f2;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;font-size:14px;margin:20px 0;">
        <strong>Lockup Period Active:</strong> Your tokens are visible in your portfolio and the token is live on the secondary market, but you may not sell until the lockup period ends on <strong>${lockFmt}</strong>. You will receive a 7-day advance warning before the lockup expires.
      </p>
      <p>Other investors may purchase your tokens on the secondary market during the lockup period — you simply cannot initiate a sell order until the lockup date.</p>
      <a href="${PLATFORM}/investor" class="btn btn-gold">View Your Portfolio &rarr;</a>
    `));
}

async function notifyConversionLockupExpiringSoon({
  investorEmail, investorName, tokenSymbol, lockupEndDate, totalSupply, currentPrice,
}) {
  const lockFmt = lockupEndDate ? new Date(lockupEndDate).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : '—';
  const priceFmt = parseFloat(currentPrice || 0).toFixed(4);
  const totalVal = (parseFloat(currentPrice || 0) * parseInt(totalSupply || 0)).toLocaleString('en-US', { style:'currency', currency:'USD' });
  return send(investorEmail, `⏰ Lockup Expiring Soon — ${tokenSymbol} (7 Days)`,
    baseTemplate(`Your ${tokenSymbol} Lockup Ends in 7 Days`, `
      <p>Dear ${investorName},</p>
      <p>This is an advance notice that the trading lockup on your <strong>${tokenSymbol}</strong> holding will expire in <strong>7 days</strong>. After this date you will be free to place sell orders on the secondary market.</p>
      <div class="detail-row"><span>Token Symbol</span><span><strong>${tokenSymbol}</strong></span></div>
      <div class="detail-row"><span>Lockup Expiry Date</span><span class="warning"><strong>${lockFmt}</strong></span></div>
      <div class="detail-row"><span>Your Holdings</span><span>${parseInt(totalSupply || 0).toLocaleString()} tokens</span></div>
      <div class="detail-row"><span>Current Price</span><span>$${priceFmt} per token</span></div>
      <div class="detail-row"><span>Estimated Portfolio Value</span><span>${totalVal}</span></div>
      <p style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;font-size:14px;margin:20px 0;">
        After <strong>${lockFmt}</strong> you can place sell orders on the TokenEquityX secondary market. No action is required on your part — your tokens will automatically become tradeable.
      </p>
      <h3 style="color:#1A3C5E;font-size:15px;margin:24px 0 8px;">What Happens Next</h3>
      <ul style="color:#374151;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 20px;">
        <li>On ${lockFmt}, the sell restriction on your holding is lifted automatically</li>
        <li>You can then place LIMIT or MARKET sell orders via the trading interface</li>
        <li>Capital gains tax may apply on any profit — consult your tax adviser</li>
      </ul>
      <a href="${PLATFORM}/investor/trade" class="btn btn-gold">Go to Trading &rarr;</a>
    `));
}

module.exports = {
  send,
  sendReconciliationEmail,
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
  notifyIssuerOfferingProposed,
  notifyInvestorOfferingClosed,
  notifyIssuerProceedsDisbursed,
  notifyIssuerEntityKycApproved,
  notifyIssuerEntityKycRejected,
  notifyIssuerAuditorAccepted,
  notifyIssuerTokenTradingLive,
  notifyInvestorTradeFilled,
  notifyAdminAuditorDeclined,
  notifyIssuerApplicationSuspended,
  notifyIssuerApplicationReinstated,
  notifyStaffAccountCreated,
  notifyIssuerMarketStateChanged,
  notifyInvestorKycSubmitted,
  notifyInvestorKycApproved,
  notifyInvestorKycRejected,
  notifyInvestorDepositInstructions,
  notifyInvestorDistributionReceived,
  notifyInvestorKycExpiring,
  notifyInvestorP2POfferAccepted,
  notifyIssuerKycApproved,
  notifyIssuerKycRejected,
  notifyAuditorKycApproved,
  notifyPartnerKycApproved,
  notifyBankingPartnerKycApproved,
  notifyStaffKycRejected,
  notifyAdminAuditorDeclarationSubmitted,
  notifyAuditorDeclarationApproved,
  notifyAuditorDeclarationRejected,
  sendEscalationNotification,
  sendIntegrityCheckAlert,
  notifyUsdcDepositInitiated,
  notifyUsdcDepositConfirmed,
  notifyUsdcWithdrawalInitiated,
  notifyUsdcWithdrawalCompleted,
  notifyUsdcPilotSuspended,
  notifyUsdcMonthlyReport,
  notifySuspiciousActivityReport,
  notifyOfferingPublicPhaseOpen,
  notifySubscriptionConfirmedPrimary,
  notifyAnchorPhaseOpen,
  notifyZimraWHTQuarterlyReport,
  notifyZimraWHTOverdue,
  notifyZimraWHTFiled,
  notifyZimraWHTPaid,
  notifyConversionSubmitted,
  notifyConversionLenderConsentRequired,
  notifyConversionApprovedTokensMinted,
  notifyConversionLockupExpiringSoon,
};
