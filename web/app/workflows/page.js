'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const NAVY = '#1A3C5E';
const GOLD  = '#C8972B';
const GREEN = '#16a34a';
const RED   = '#dc2626';
const TEAL  = '#0891b2';
const PURPLE= '#7c3aed';

// ── Shared components
function FlowArrow({ label, vertical = false }) {
  return (
    <div className={`flex ${vertical ? 'flex-col' : 'flex-row'} items-center gap-1`}>
      {label && <span className="text-xs text-gray-500 text-center">{label}</span>}
      <div className={`flex items-center justify-center ${vertical ? 'flex-col' : 'flex-row'}`}>
        {vertical ? (
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-6 bg-gradient-to-b from-gray-600 to-gray-400"/>
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-6 border-l-transparent border-r-transparent border-t-gray-400"/>
          </div>
        ) : (
          <div className="flex items-center">
            <div className="h-0.5 w-8 bg-gradient-to-r from-gray-600 to-gray-400"/>
            <div className="w-0 h-0 border-t-4 border-b-4 border-l-6 border-t-transparent border-b-transparent border-l-gray-400"/>
          </div>
        )}
      </div>
    </div>
  );
}

function Node({ icon, label, sublabel, color = NAVY, size = 'md', highlight = false }) {
  const sizeMap = { sm: 'p-3', md: 'p-4', lg: 'p-5' };
  return (
    <div className={`rounded-xl border ${sizeMap[size]} text-center transition-all ${highlight ? 'ring-2 ring-yellow-400/50' : ''}`}
      style={{ background: `${color}22`, borderColor: `${color}66` }}>
      <div className="text-2xl mb-1">{icon}</div>
      <p className="font-bold text-sm text-white leading-tight">{label}</p>
      {sublabel && <p className="text-xs mt-0.5" style={{ color: `${color}cc` }}>{sublabel}</p>}
    </div>
  );
}

function Step({ number, title, desc, color = NAVY }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0 mt-0.5"
        style={{ background: color }}>{number}</div>
      <div>
        <p className="font-bold text-sm text-white">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function Badge({ label, color }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
      style={{ background: `${color}33`, color, border: `1px solid ${color}55` }}>
      {label}
    </span>
  );
}

function ConnectorLine({ label, dashed = false }) {
  return (
    <div className="flex flex-col items-center my-1">
      <div className={`w-px h-8 ${dashed ? 'border-l-2 border-dashed border-gray-600' : 'bg-gradient-to-b from-gray-600 to-gray-500'}`}/>
      {label && <span className="text-xs text-gray-500 bg-gray-900 px-2 -mt-2 z-10">{label}</span>}
      <svg width="10" height="6" className="mt-0.5"><polygon points="5,6 0,0 10,0" fill="#6b7280"/></svg>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// DIAGRAM 1 — INVESTOR FUNDS FLOW
// ════════════════════════════════════════════════════════════════
function Diagram1() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

        {/* DEPOSIT FLOW */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-lg">💰</span>
            <h3 className="font-bold text-green-400">Deposit Flow — Fiat Rail</h3>
          </div>
          <div className="space-y-2">
            <Node icon="🏦" label="Investor Bank Account" sublabel="Any Zimbabwe bank" color={TEAL}/>
            <ConnectorLine label="EFT / RTGS transfer"/>
            <Node icon="🏛️" label="Stanbic Custodial Account" sublabel="TokenEquityX Ltd corporate account" color={NAVY}/>
            <ConnectorLine label="Admin verifies on Stanbic portal"/>
            <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-300 font-semibold">⚙️ Admin Action</p>
              <p className="text-xs text-gray-400 mt-1">Matches reference number · Confirms amount · Clicks Confirm in admin dashboard</p>
            </div>
            <ConnectorLine label="Platform credits wallet"/>
            <Node icon="👛" label="Investor USD Wallet" sublabel="balance_usd increases" color={GREEN}/>
            <ConnectorLine label="Investor places orders"/>
            <Node icon="📊" label="Available for Investment" sublabel="Trade · Subscribe · Earn" color={GOLD}/>
          </div>
        </div>

        {/* WITHDRAWAL FLOW */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-lg">🏦</span>
            <h3 className="font-bold text-amber-400">Withdrawal Flow — Fiat Rail</h3>
          </div>
          <div className="space-y-2">
            <Node icon="👛" label="Investor USD Wallet" sublabel="Sells tokens or receives distributions" color={GREEN}/>
            <ConnectorLine label="Investor requests withdrawal"/>
            <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-300 font-semibold">🔒 Funds Reserved</p>
              <p className="text-xs text-gray-400 mt-1">balance_usd reserved · Cannot be used for trading until processed</p>
            </div>
            <ConnectorLine label="Admin processes request"/>
            <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-300 font-semibold">⚙️ Admin Action</p>
              <p className="text-xs text-gray-400 mt-1">Initiates EFT/RTGS from Stanbic · Enters bank reference · Marks complete</p>
            </div>
            <ConnectorLine label="Transfer executed"/>
            <Node icon="🏛️" label="Stanbic Custodial Account" sublabel="Funds debited" color={NAVY}/>
            <ConnectorLine label="EFT / RTGS (1-2 business days)"/>
            <Node icon="🏦" label="Investor Bank Account" sublabel="Funds arrive" color={TEAL}/>
          </div>
        </div>
      </div>

      {/* Key controls */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
        <h3 className="font-bold mb-4 text-gray-300">🔐 Key Controls & Reconciliation</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon:'⚖️', title:'Daily Reconciliation', desc:'Total investor balance_usd across all wallets must equal actual Stanbic custodial account balance. Reconcile every business day before processing withdrawals.' },
            { icon:'📋', title:'Audit Trail', desc:'Every deposit confirmation and withdrawal completion is logged with admin ID, timestamp and bank reference. All wallet_transactions records are immutable.' },
            { icon:'🔒', title:'Reserved Funds Control', desc:'Withdrawal amounts are reserved immediately on request, preventing double-spend. Funds only debited from balance when admin marks complete.' },
          ].map((c,i) => (
            <div key={i} className="bg-gray-800/50 rounded-xl p-4">
              <span className="text-2xl mb-2 block">{c.icon}</span>
              <p className="font-bold text-sm mb-1">{c.title}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Fee schedule */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
        <h3 className="font-bold mb-4 text-gray-300">💸 Fee Schedule</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-700 text-gray-500 text-xs">
              {['Transaction Type','Fee','Deducted From','Credited To'].map(h=><th key={h} className="text-left pb-2 pr-4">{h}</th>)}
            </tr></thead>
            <tbody className="space-y-2">
              {[
                ['Deposit',           'None',         'N/A',               'N/A'],
                ['Withdrawal',        'None',         'N/A',               'N/A'],
                ['Secondary Trade',   '0.50%',        'Seller proceeds',   'Platform treasury'],
                ['SECZ Levy',         '0.32%',        'Seller proceeds',   'Platform treasury (remit to SECZ)'],
                ['Primary Issuance',  '2.00%',        'Gross proceeds',    'Platform treasury'],
                ['Withholding Tax',   '10% / 15%',    'Distribution gross','Platform treasury (remit to ZIMRA)'],
              ].map(([type,fee,from,to],i) => (
                <tr key={i} className="border-b border-gray-800/50">
                  <td className="py-2 pr-4 font-medium">{type}</td>
                  <td className="py-2 pr-4 font-bold" style={{color:GOLD}}>{fee}</td>
                  <td className="py-2 pr-4 text-gray-400 text-xs">{from}</td>
                  <td className="py-2 text-gray-400 text-xs">{to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// DIAGRAM 2 — ISSUER LIFECYCLE
// ════════════════════════════════════════════════════════════════
function Diagram2() {
  const stages = [
    { icon:'🏢', title:'SPV Registration', color:TEAL, steps:[
      'Issuer registers a Special Purpose Vehicle at ZIMRA and Registrar of Companies',
      'SPV is ring-fenced from issuer\'s other assets and liabilities',
      'SPV bank account opened at Stanbic — all asset cash flows routed through SPV',
      'Directors submit KYC documentation to TokenEquityX',
    ]},
    { icon:'📋', title:'Tokenisation Application', color:NAVY, steps:[
      'Issuer submits tokenisation application via platform dashboard (Journey tab)',
      'Legal entity name, proposed symbol, asset class, and supporting documents uploaded',
      'Application assigned a reference number and enters the review pipeline',
      'Compliance Officer reviews KYC package and beneficial ownership structure',
    ]},
    { icon:'🔍', title:'Auditor Valuation', color:PURPLE, steps:[
      'Issuer submits financial data — revenue, EBITDA, asset values, growth projections',
      'Platform valuation engine generates reference price using appropriate model',
      'ICAZ-qualified auditor reviews financial data and engine output',
      'Auditor certifies oracle price and submits audit report with risk rating',
    ]},
    { icon:'🏛️', title:'Admin Approval & SECZ', color:GOLD, steps:[
      'Admin reviews auditor report and selects listing type (Brownfield Bourse or Greenfield P2P)',
      'SECZ Innovation Hub sandbox application submitted with prospectus',
      'Token status moves to PRIMARY_ONLY — primary offering can now be launched',
      'Smart contract deployed on Polygon PoS (post-RBZ approval)',
    ]},
    { icon:'💰', title:'Primary Offering', color:GREEN, steps:[
      'Issuer proposes offering: price, target raise, token quantity, subscription window',
      'Auditor reviews proposed price against certified oracle price',
      'Admin approves — offering opens to KYC-verified investors',
      'On close: 2% issuance fee deducted, net proceeds credited to issuer wallet',
    ]},
    { icon:'📈', title:'Secondary Market', color:RED, steps:[
      'Token moves to FULL_TRADING — order book open to all KYC-verified investors',
      'Buyers and sellers matched via price-time priority matching engine',
      '0.50% platform fee + 0.32% SECZ levy deducted on every matched trade',
      'Oracle price updated to last matched trade price in real time',
    ]},
    { icon:'💵', title:'Distributions', color:TEAL, steps:[
      'Issuer deposits distribution pool from SPV bank account',
      'Platform calculates each holder\'s pro-rata share from token_holdings',
      'Withholding tax deducted: 10% residents, 15% non-residents (Zimbabwe Income Tax Act)',
      'Net amount credited to each investor\'s USD wallet — claimable immediately',
    ]},
  ];

  return (
    <div className="space-y-4">
      {stages.map((stage, i) => (
        <div key={i} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background:`${stage.color}22`, border:`1px solid ${stage.color}55` }}>
              {stage.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white"
                  style={{ background: stage.color }}>{i+1}</div>
                <h3 className="font-bold text-lg" style={{ color: stage.color }}>{stage.title}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {stage.steps.map((step, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                      style={{ background: stage.color }}/>
                    <p className="text-xs text-gray-300 leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {i < stages.length - 1 && (
            <div className="flex justify-center mt-4">
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-gray-700"/>
                <svg width="10" height="6"><polygon points="5,6 0,0 10,0" fill="#4b5563"/></svg>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// DIAGRAM 3 — TRADE SETTLEMENT FLOW
// ════════════════════════════════════════════════════════════════
function Diagram3() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Order placement */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-bold text-blue-400 mb-4">1. Order Placement</h3>
          <div className="space-y-2">
            <Node icon="👤" label="Buyer" sublabel="Places BUY order" color={GREEN}/>
            <ConnectorLine label="Limit or market order"/>
            <Node icon="👤" label="Seller" sublabel="Places SELL order" color={RED}/>
            <ConnectorLine label="Stored in orders table"/>
            <Node icon="📋" label="Order Book" sublabel="Price-time priority queue" color={NAVY}/>
          </div>
          <div className="mt-4 bg-blue-900/20 border border-blue-800/40 rounded-lg p-3 text-xs text-blue-300 space-y-1">
            <p className="font-semibold">Validation checks:</p>
            <p>✓ Token in FULL_TRADING state</p>
            <p>✓ Market not halted</p>
            <p>✓ Buyer has sufficient balance</p>
            <p>✓ Seller has token holdings</p>
          </div>
        </div>

        {/* Matching engine */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-bold text-purple-400 mb-4">2. Matching Engine</h3>
          <div className="space-y-2">
            <Node icon="⚙️" label="matchOrders()" sublabel="Price-time priority algorithm" color={PURPLE}/>
            <ConnectorLine label="Buy price ≥ Sell price"/>
            <div className="bg-purple-900/20 border border-purple-800/40 rounded-lg p-3 text-xs">
              <p className="text-purple-300 font-semibold mb-1">Trade Price Determination</p>
              <p className="text-gray-400">Market vs Market → Oracle price</p>
              <p className="text-gray-400">Market vs Limit → Limit price</p>
              <p className="text-gray-400">Limit vs Limit → Maker price</p>
            </div>
            <ConnectorLine label="Calculate fees"/>
            <div className="bg-gray-800/50 rounded-lg p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Trade value</span><span className="text-white font-mono">qty × price</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Platform fee</span><span className="text-red-400 font-mono">× 0.50%</span></div>
              <div className="flex justify-between"><span className="text-gray-500">SECZ levy</span><span className="text-red-400 font-mono">× 0.32%</span></div>
              <div className="flex justify-between border-t border-gray-700 pt-1"><span className="text-gray-300 font-semibold">Seller net</span><span className="text-green-400 font-mono">value − fees</span></div>
            </div>
          </div>
        </div>

        {/* Settlement */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-bold text-green-400 mb-4">3. Atomic Settlement</h3>
          <div className="space-y-2">
            <div className="bg-green-900/20 border border-green-800/40 rounded-lg p-2 text-xs text-green-300 text-center">DB Transaction — all or nothing</div>
            <div className="space-y-1.5 text-xs">
              {[
                ['Trade record inserted', 'trades table', GREEN],
                ['Buyer balance debited', 'balance_usd −= value', RED],
                ['Seller balance credited', 'balance_usd += net', GREEN],
                ['Fees to treasury', 'usd_liability += fees', GOLD],
                ['Buyer tokens credited', 'token_holdings +qty', GREEN],
                ['Seller tokens debited', 'token_holdings −qty', RED],
                ['Orders updated', 'FILLED / PARTIAL', NAVY],
                ['Token price updated', 'current_price_usd', PURPLE],
                ['3× wallet_transactions', 'BUY, SELL, FEE', TEAL],
              ].map(([action, detail, color], j) => (
                <div key={j} className="flex items-center gap-2 bg-gray-800/40 rounded-lg px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:color}}/>
                  <span className="text-gray-300 flex-1">{action}</span>
                  <span className="font-mono text-gray-500" style={{fontSize:'10px'}}>{detail}</span>
                </div>
              ))}
            </div>
            <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg p-2 text-xs text-blue-300 text-center">
              WebSocket emits real-time trade event to all connected clients
            </div>
          </div>
        </div>
      </div>

      {/* Settlement rail note */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-bold mb-3 text-gray-300">⚡ Settlement Rail</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-4">
            <p className="font-bold text-blue-300 mb-2">🏦 Fiat Rail (Default)</p>
            <p className="text-xs text-gray-400 leading-relaxed">All value moves as USD in the platform database. No actual USDC moves. Buyer's balance_usd debited, seller's credited. Operates entirely within the platform's fiat accounting layer. Suitable for sandbox phase.</p>
          </div>
          <div className="bg-purple-900/20 border border-purple-700/40 rounded-xl p-4">
            <p className="font-bold text-purple-300 mb-2">🔵 USDC Rail (Future)</p>
            <p className="text-xs text-gray-400 leading-relaxed">Buyer's balance_usdc debited, seller's credited. Requires RBZ Exchange Control approval and smart contract deployment on Polygon PoS. TradeEngine contract executes atomic token-for-USDC swap on-chain. Post-RBZ sandbox approval only.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// DIAGRAM 4 — PRIMARY OFFERING FLOW
// ════════════════════════════════════════════════════════════════
function Diagram4() {
  const phases = [
    {
      phase: 'PROPOSAL', color: TEAL, icon: '📤',
      actor: 'Issuer', status: 'PENDING_APPROVAL',
      actions: [
        'Issuer logs into dashboard → Journey tab → Primary Offering section',
        'Completes offering form: price per token, target raise, total tokens, subscription deadline, min/max subscription limits',
        'Writes offering rationale — purpose of raise, use of proceeds, price justification',
        'Submits — status set to PENDING_APPROVAL',
      ],
    },
    {
      phase: 'AUDITOR REVIEW', color: PURPLE, icon: '🔍',
      actor: 'Auditor', status: 'AUDITOR_REVIEWED',
      actions: [
        'Auditor reviews proposed offering price against certified oracle price',
        'Assesses whether fundraise target is realistic given asset valuation',
        'Submits recommendation: APPROVE, REJECT, or REQUEST_CHANGES',
        'Adds price assessment note and detailed findings',
      ],
    },
    {
      phase: 'ADMIN APPROVAL', color: GOLD, icon: '✅',
      actor: 'Admin', status: 'OPEN',
      actions: [
        'Admin reviews offering terms and auditor recommendation',
        'Reviews auditor\'s risk rating and price assessment',
        'Approves → status set to OPEN, token moves to PRIMARY_ONLY',
        'Investors can now subscribe — secondary trading suspended during offering',
      ],
    },
    {
      phase: 'SUBSCRIPTION', color: GREEN, icon: '💰',
      actor: 'Investors', status: 'OPEN',
      actions: [
        'KYC-verified investors browse open offerings on investor dashboard',
        'Investor selects amount within min/max limits',
        'Platform checks balance on selected settlement rail (FIAT or USDC)',
        'Funds reserved immediately — tokens allocated pro-rata at offering price',
      ],
    },
    {
      phase: 'CLOSE & DISBURSE', color: RED, icon: '🏦',
      actor: 'Admin', status: 'DISBURSED',
      actions: [
        'Admin reviews total subscriptions and subscriber list',
        'Initiates physical bank transfer of gross proceeds to issuer SPV bank account',
        'Enters Stanbic bank transfer reference number in platform',
        'Platform deducts 2% issuance fee → credits net proceeds to issuer wallet',
        'All subscriber token_holdings updated atomically',
        'Token moves to FULL_TRADING — secondary market opens',
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {phases.map((phase, i) => (
        <div key={i}>
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className="text-center flex-shrink-0">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-1"
                  style={{ background:`${phase.color}22`, border:`1px solid ${phase.color}55` }}>
                  {phase.icon}
                </div>
                <Badge label={phase.status.replace('_',' ')} color={phase.color}/>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Phase {i+1}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">{phase.actor}</span>
                </div>
                <h3 className="font-black text-lg mb-3" style={{color:phase.color}}>{phase.phase}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {phase.actions.map((action, j) => (
                    <div key={j} className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                        style={{background:`${phase.color}33`, color:phase.color}}>{j+1}</span>
                      <p className="text-xs text-gray-300 leading-relaxed">{action}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {i < phases.length - 1 && (
            <div className="flex justify-center my-1">
              <div className="flex flex-col items-center">
                <div className="w-px h-3 bg-gray-700"/>
                <svg width="10" height="6"><polygon points="5,6 0,0 10,0" fill="#4b5563"/></svg>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Fee summary */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-bold mb-3 text-gray-300">💸 Proceeds Calculation Example</h3>
        <div className="bg-gray-800/50 rounded-xl p-4 font-mono text-sm space-y-2">
          <div className="flex justify-between"><span className="text-gray-400">Total subscriptions</span><span className="text-white">$2,000,000.00</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Issuance fee (2.00%)</span><span className="text-red-400">−$40,000.00</span></div>
          <div className="flex justify-between border-t border-gray-700 pt-2 font-bold"><span className="text-gray-200">Net proceeds to issuer</span><span className="text-green-400">$1,960,000.00</span></div>
          <div className="flex justify-between text-xs text-gray-500"><span>Platform treasury receives</span><span>$40,000.00</span></div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// DIAGRAM 5 — DISTRIBUTION FLOW
// ════════════════════════════════════════════════════════════════
function Diagram5() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Distribution creation */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-bold text-green-400 mb-4">1. Distribution Creation</h3>
          <div className="space-y-3">
            <Step number="1" title="Issuer deposits distribution pool" desc="Issuer transfers total distribution amount from SPV bank account to Stanbic custodial account. Admin confirms on platform — issuer wallet_usd credited." color={GREEN}/>
            <Step number="2" title="Issuer creates distribution round" desc="Logs into issuer dashboard → Dividends tab. Enters: token symbol, round type (Dividend/Coupon), total amount, amount per token, claim window." color={GREEN}/>
            <Step number="3" title="Amount per token calculation" desc="amount_per_token = total_pool ÷ total_tokens_in_circulation. This is the gross amount before withholding tax deduction." color={GREEN}/>
            <Step number="4" title="Round opens for claims" desc="Status set to OPEN. All token holders with balance > 0 can now see the distribution in their investor dashboard." color={GREEN}/>
          </div>
        </div>

        {/* Investor claim flow */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-bold text-blue-400 mb-4">2. Investor Claim & WHT Calculation</h3>
          <div className="space-y-3">
            <Step number="1" title="Investor sees claimable distribution" desc="Platform shows estimated gross payout, withholding tax amount, and net payout based on investor's token holdings and KYC country." color={TEAL}/>
            <Step number="2" title="Investor clicks Claim" desc="Platform loads token_holdings.balance for this investor and token. Calculates gross = balance × amount_per_token." color={TEAL}/>
            <Step number="3" title="Withholding tax deducted" desc="KYC country checked. Zimbabwe residents: 10% WHT. Non-residents: 15% WHT. Defaults to 15% if no approved KYC exists." color={TEAL}/>
            <Step number="4" title="Net amount credited" desc="Investor's balance_usd increases by net amount. WHT amount goes to platform_treasury.usd_liability for ZIMRA remittance." color={TEAL}/>
          </div>
        </div>
      </div>

      {/* WHT calculation example */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-bold mb-4 text-gray-300">📊 Withholding Tax Calculation Examples</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              label: '🇿🇼 Zimbabwe Resident (10% WHT)',
              color: GREEN,
              example: [
                ['Token holdings', '5,000 HCPR'],
                ['Amount per token', '$0.0800'],
                ['Gross distribution', '$400.00'],
                ['WHT (10%)', '−$40.00'],
                ['Net to investor', '$360.00'],
                ['To ZIMRA pool', '$40.00'],
              ]
            },
            {
              label: '🌍 Non-Resident (15% WHT)',
              color: GOLD,
              example: [
                ['Token holdings', '5,000 HCPR'],
                ['Amount per token', '$0.0800'],
                ['Gross distribution', '$400.00'],
                ['WHT (15%)', '−$60.00'],
                ['Net to investor', '$340.00'],
                ['To ZIMRA pool', '$60.00'],
              ]
            }
          ].map((ex, i) => (
            <div key={i} className="bg-gray-800/50 rounded-xl p-4">
              <p className="font-bold text-sm mb-3" style={{color:ex.color}}>{ex.label}</p>
              <div className="font-mono text-xs space-y-1.5">
                {ex.example.map(([label, value], j) => (
                  <div key={j} className={`flex justify-between ${j===4?'border-t border-gray-700 pt-1.5 font-bold':''}`}>
                    <span className="text-gray-400">{label}</span>
                    <span className={j===4?'text-green-400':j===3?'text-red-400':j===5?'text-amber-400':'text-white'}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ZIMRA remittance */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-bold mb-3 text-gray-300">🏛️ ZIMRA Remittance Process</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { step:'1', icon:'📊', title:'WHT Accumulates', desc:'All withheld amounts credited to platform_treasury.usd_liability. Admin summary endpoint shows resident vs non-resident WHT breakdown per distribution round.' },
            { step:'2', icon:'📋', title:'ZIMRA Return Filed', desc:'Admin generates WHT summary report from /api/dividends/admin/summary. Details total resident WHT (10%) and non-resident WHT (15%) separately as required by ZIMRA.' },
            { step:'3', icon:'🏦', title:'Remittance to ZIMRA', desc:'Admin initiates wire transfer from Stanbic custodial account to ZIMRA\'s designated collection account. Transfer reference recorded in platform audit log.' },
          ].map((s,i) => (
            <div key={i} className="bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white" style={{background:GOLD}}>{s.step}</div>
                <span className="text-xl">{s.icon}</span>
              </div>
              <p className="font-bold text-sm mb-1">{s.title}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-amber-900/20 border border-amber-800/40 rounded-lg p-3 text-xs text-amber-300">
          ⚠️ WHT remittance to ZIMRA is a legal obligation under Zimbabwe Income Tax Act [Chapter 23:06]. Frequency and form of remittance to be confirmed with ZIMRA upon platform licensing.
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════
const DIAGRAMS = [
  { id:'funds',     label:'Investor Funds Flow',      icon:'💰', component: Diagram1, desc:'How money moves between investor bank accounts, the Stanbic custodial account, and platform wallets.' },
  { id:'lifecycle', label:'Issuer Lifecycle',         icon:'🏢', component: Diagram2, desc:'The complete journey from SPV registration through tokenisation, primary offering and secondary market.' },
  { id:'trade',     label:'Trade Settlement',         icon:'⚙️', component: Diagram3, desc:'How orders are matched, fees calculated, and wallets settled atomically on every trade.' },
  { id:'offering',  label:'Primary Offering Flow',    icon:'📈', component: Diagram4, desc:'The five-phase workflow from issuer proposal through auditor review, admin approval and disbursement.' },
  { id:'distrib',   label:'Distribution & WHT Flow',  icon:'💵', component: Diagram5, desc:'How dividends and coupons are calculated, withholding tax deducted, and ZIMRA remittance managed.' },
];

export default function WorkflowsPage() {
  const router   = useRouter();
  const [active, setActive] = useState('funds');
  const current  = DIAGRAMS.find(d => d.id === active);
  const Component = current?.component;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white pt-20">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .bg-gray-950 { background: white !important; }
          .bg-gray-900\\/60 { background: #f9fafb !important; border: 1px solid #e5e7eb !important; }
          .text-white { color: #111827 !important; }
          .text-gray-400 { color: #6b7280 !important; }
        }
      `}</style>

      {/* Header */}
      <section className="py-16 px-6 border-b border-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block text-xs uppercase tracking-[0.3em] text-gray-500 mb-6 border border-gray-800 px-4 py-2 rounded-full">Platform Documentation</span>
          <h1 className="text-5xl font-black mb-4">Platform <span style={{color:GOLD}}>Workflow Diagrams</span></h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto">
            Detailed operational workflows for all core platform processes. Prepared for SECZ Innovation Hub Sandbox submission and internal operational use.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6 flex-wrap no-print">
            <span className="text-xs bg-blue-900/50 text-blue-300 px-3 py-1.5 rounded-full border border-blue-800">SECZ Sandbox Reference</span>
            <span className="text-xs bg-green-900/50 text-green-300 px-3 py-1.5 rounded-full border border-green-800">5 Workflow Diagrams</span>
            <span className="text-xs bg-amber-900/50 text-amber-300 px-3 py-1.5 rounded-full border border-amber-800">Print-Ready PDF</span>
          </div>
        </div>
      </section>

      <div className="max-w-screen-xl mx-auto px-6 py-8">
        <div className="flex flex-col xl:flex-row gap-8">

          {/* Sidebar nav */}
          <div className="xl:w-72 flex-shrink-0 no-print">
            <div className="sticky top-24 space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 px-2">Diagrams</p>
              {DIAGRAMS.map((d, i) => (
                <button key={d.id} onClick={() => setActive(d.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-start gap-3 ${
                    active === d.id
                      ? 'text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                  style={active === d.id ? {background:`${NAVY}`, border:`1px solid #2563eb55`} : {}}>
                  <span className="text-lg flex-shrink-0">{d.icon}</span>
                  <div>
                    <p className="font-semibold text-sm leading-tight">{d.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-tight">{d.desc}</p>
                  </div>
                </button>
              ))}

              <div className="pt-4 border-t border-gray-800 space-y-2">
                <button onClick={handlePrint}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-900 hover:opacity-90 transition-all"
                  style={{background:GOLD}}>
                  🖨️ Print / Save as PDF
                </button>
                <button onClick={() => router.push('/resources')}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-800 hover:bg-gray-700 text-white">
                  ← Back to Resources
                </button>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-6 no-print">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl">{current?.icon}</span>
                  <h2 className="text-2xl font-black">{current?.label}</h2>
                </div>
                <p className="text-gray-400 text-sm">{current?.desc}</p>
              </div>
              <button onClick={handlePrint}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-800 hover:bg-gray-700 text-white flex items-center gap-2">
                🖨️ Print
              </button>
            </div>

            {Component && <Component />}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t border-gray-800 no-print">
              {DIAGRAMS.findIndex(d=>d.id===active) > 0 ? (
                <button
                  onClick={()=>setActive(DIAGRAMS[DIAGRAMS.findIndex(d=>d.id===active)-1].id)}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                  ← Previous
                </button>
              ) : <div/>}
              {DIAGRAMS.findIndex(d=>d.id===active) < DIAGRAMS.length-1 ? (
                <button
                  onClick={()=>setActive(DIAGRAMS[DIAGRAMS.findIndex(d=>d.id===active)+1].id)}
                  className="flex items-center gap-2 text-sm font-semibold hover:opacity-80 transition-opacity"
                  style={{color:GOLD}}>
                  Next Diagram →
                </button>
              ) : <div/>}
            </div>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <section className="py-8 px-6 border-t border-gray-800">
        <div className="max-w-screen-xl mx-auto">
          <p className="text-center text-gray-700 text-xs leading-relaxed max-w-4xl mx-auto">
            TokenEquityX Ltd · SECZ Innovation Hub Sandbox · Harare, Zimbabwe · tokenequityx.co.zw ·
            These workflow diagrams are prepared for regulatory submission and internal operational use.
            All flows subject to RBZ Exchange Control and SECZ licensing conditions.
          </p>
        </div>
      </section>
    </div>
  );
}
