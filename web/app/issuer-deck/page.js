'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

// ── Slide data ────────────────────────────────────────────────────────────────

const SLIDES = [
  { id: 'title' },
  { id: 'problem' },
  { id: 'solution' },
  { id: 'how-it-works' },
  { id: 'issuer-value' },
  { id: 'investor-access' },
  { id: 'regulatory' },
  { id: 'asset-classes' },
  { id: 'technology' },
  { id: 'fees' },
  { id: 'case-study' },
  { id: 'next-steps' },
  { id: 'team' },
];

// ── Shared layout primitives ──────────────────────────────────────────────────

function SlideWrapper({ children, center = true }) {
  return (
    <div className={`w-full h-full flex flex-col ${center ? 'items-center justify-center' : 'justify-start'} px-8 md:px-16 lg:px-24 py-12 print:py-8 overflow-y-auto`}>
      {children}
    </div>
  );
}

function SlideTag({ children }) {
  return (
    <span className="inline-block mb-4 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-semibold tracking-widest uppercase">
      {children}
    </span>
  );
}

function SlideTitle({ children, className = '' }) {
  return (
    <h2 className={`text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6 ${className}`}>
      {children}
    </h2>
  );
}

function Gold({ children }) {
  return <span className="text-yellow-400">{children}</span>;
}

// ── Individual slides ─────────────────────────────────────────────────────────

function SlideTitle1() {
  return (
    <SlideWrapper>
      <div className="text-center max-w-4xl">
        <div className="mb-8">
          <span className="text-4xl md:text-5xl font-black tracking-tight">
            <Gold>Token</Gold>
            <span className="text-white">Equity</span>
            <Gold>X</Gold>
          </span>
        </div>
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
          Africa&apos;s Regulated<br />
          <Gold>Digital Capital Market</Gold>
        </h1>
        <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
          Tokenise equity, real estate, mining rights and bonds on the SECZ Innovation Hub Sandbox.
          Raise capital from retail, institutional and diaspora investors — in weeks, not years.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {['SECZ Regulated', 'Polygon Blockchain', 'USDC Settlement', 'KYC/AML Compliant'].map(b => (
            <span key={b} className="px-3 py-1.5 rounded-full bg-slate-700/60 border border-slate-600 text-slate-300 text-sm">{b}</span>
          ))}
        </div>
        <div className="border-t border-slate-700 pt-8">
          <p className="text-slate-400 text-sm mb-1">Presented by</p>
          <p className="text-white font-semibold text-lg">Richard Chimuka — CEO &amp; Co-Founder</p>
          <p className="text-slate-400 text-sm mt-1">richard@tokenequityx.co.zw · tokenequityx.co.zw</p>
        </div>
      </div>
    </SlideWrapper>
  );
}

function SlideProblem() {
  const stats = [
    { value: '< 60', label: 'companies listed on the ZSE', note: 'vs 1,000+ on Johannesburg Stock Exchange', icon: '📉' },
    { value: '$2.1B', label: 'SME financing gap per year', note: 'Businesses locked out of formal capital', icon: '🔒' },
    { value: '$1.5B', label: 'diaspora remittances sitting idle', note: 'No regulated investment vehicle for diaspora', icon: '🌍' },
  ];
  return (
    <SlideWrapper>
      <div className="max-w-5xl w-full">
        <SlideTag>The Problem</SlideTag>
        <SlideTitle>Zimbabwe&apos;s Capital Markets<br /><Gold>Are Broken</Gold></SlideTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {stats.map(s => (
            <div key={s.value} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-3">{s.icon}</div>
              <div className="text-4xl md:text-5xl font-black text-yellow-400 mb-2">{s.value}</div>
              <div className="text-white font-semibold mb-2">{s.label}</div>
              <div className="text-slate-400 text-sm">{s.note}</div>
            </div>
          ))}
        </div>
        <div className="bg-red-900/20 border border-red-700/40 rounded-2xl p-5 text-center">
          <p className="text-red-300 text-base md:text-lg font-medium">
            "The infrastructure is 20 years old. The costs are prohibitive. The access is exclusive.<br />
            <strong className="text-red-200">Zimbabwe&apos;s most promising companies are invisible to capital."</strong>
          </p>
        </div>
      </div>
    </SlideWrapper>
  );
}

function SlideSolution() {
  const pillars = [
    { icon: '⛓️', title: 'On-Chain Settlement',  desc: 'Every transaction immutably recorded on Polygon blockchain' },
    { icon: '🏛️', title: 'SECZ Regulated',       desc: 'Full regulatory oversight under Innovation Hub Sandbox' },
    { icon: '💵', title: 'USDC Denominated',      desc: 'USD-stable settlement — no currency risk for investors' },
    { icon: '🌍', title: 'Pan-African Access',    desc: 'Retail, institutional, and diaspora investors in one place' },
    { icon: '📋', title: 'Smart Contracts',       desc: 'Automated compliance, distribution and governance' },
    { icon: '📊', title: 'Real-Time Pricing',     desc: 'Independent auditor-certified oracle-based valuations' },
  ];
  return (
    <SlideWrapper>
      <div className="max-w-5xl w-full">
        <SlideTag>The Solution</SlideTag>
        <SlideTitle>One Platform.<br /><Gold>Every Capital Need.</Gold></SlideTitle>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 mb-8 text-center">
          <p className="text-yellow-200 text-lg md:text-xl font-medium">
            TokenEquityX bridges the gap between untapped African capital and growth-stage companies —
            through regulated, blockchain-powered tokenisation.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {pillars.map(p => (
            <div key={p.title} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex items-start gap-3">
              <span className="text-2xl shrink-0">{p.icon}</span>
              <div>
                <div className="text-white font-semibold text-sm mb-1">{p.title}</div>
                <div className="text-slate-400 text-xs leading-relaxed">{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideWrapper>
  );
}

function SlideHowItWorks() {
  const steps = [
    { n: 1, icon: '📝', title: 'Apply',         desc: 'Submit application & $500 fee' },
    { n: 2, icon: '🪪', title: 'KYC/AML',       desc: 'Entity & director verification' },
    { n: 3, icon: '🔍', title: 'Audit',          desc: 'Certified auditor assigned' },
    { n: 4, icon: '🪙', title: 'Tokenise',       desc: 'Smart contract deployed' },
    { n: 5, icon: '🚀', title: 'Raise',          desc: 'Investor subscriptions open' },
    { n: 6, icon: '💸', title: 'Settle',         desc: 'USDC transferred on-chain' },
    { n: 7, icon: '📋', title: 'List',           desc: 'Token listed on platform' },
    { n: 8, icon: '🔄', title: 'Trade',          desc: '24/7 secondary market' },
  ];
  return (
    <SlideWrapper>
      <div className="max-w-5xl w-full">
        <SlideTag>Process</SlideTag>
        <SlideTitle>From Application<br />to <Gold>Secondary Market</Gold></SlideTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-center">
                <div className="w-7 h-7 rounded-full bg-yellow-500 text-slate-900 text-xs font-black flex items-center justify-center mx-auto mb-2">
                  {s.n}
                </div>
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className="text-white font-semibold text-sm mb-1">{s.title}</div>
                <div className="text-slate-400 text-xs leading-snug">{s.desc}</div>
              </div>
              {i < steps.length - 1 && i % 4 !== 3 && (
                <div className="hidden md:block absolute top-1/2 -right-2 text-yellow-500 font-bold text-lg z-10">›</div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-center gap-8 text-sm">
          <div className="text-center"><div className="text-yellow-400 font-bold text-2xl">4–8</div><div className="text-slate-400">weeks to raise</div></div>
          <div className="text-center"><div className="text-yellow-400 font-bold text-2xl">$100K</div><div className="text-slate-400">minimum raise</div></div>
          <div className="text-center"><div className="text-yellow-400 font-bold text-2xl">24/7</div><div className="text-slate-400">secondary trading</div></div>
        </div>
      </div>
    </SlideWrapper>
  );
}

function SlideIssuerValue() {
  const rows = [
    { label: 'Time to list',      zse: '18–24 months',      tex: '4–8 weeks',        good: true },
    { label: 'Minimum raise',     zse: '$5,000,000+',        tex: '$100,000',         good: true },
    { label: 'Investor reach',    zse: 'Institutional only', tex: 'Retail + Inst. + Diaspora', good: true },
    { label: 'Annual listing fee',zse: '$50,000+',            tex: 'From $2,500/yr',   good: true },
    { label: 'Regulatory body',   zse: 'SECZ (full exchange)',tex: 'SECZ (sandbox)',   good: false },
    { label: 'Secondary trading', zse: 'ZSE hours (Mon–Fri)', tex: '24/7 on-platform', good: true },
    { label: 'Currency',          zse: 'ZiG / ZWL',          tex: 'USDC (USD-stable)', good: true },
  ];
  return (
    <SlideWrapper>
      <div className="max-w-4xl w-full">
        <SlideTag>Issuer Value</SlideTag>
        <SlideTitle><Gold>Why TokenEquityX</Gold><br />vs Traditional Routes</SlideTitle>
        <div className="overflow-x-auto rounded-2xl border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800 border-b border-slate-700">
                <th className="text-left py-3 px-5 text-slate-400 font-medium">Metric</th>
                <th className="text-center py-3 px-5 text-slate-400 font-medium">Traditional (ZSE/Banks)</th>
                <th className="text-center py-3 px-5 text-yellow-400 font-semibold">TokenEquityX</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.label} className={`border-b border-slate-800 ${i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/30'}`}>
                  <td className="py-3 px-5 text-white font-medium">{r.label}</td>
                  <td className="py-3 px-5 text-center text-slate-400">{r.zse}</td>
                  <td className={`py-3 px-5 text-center font-semibold ${r.good ? 'text-green-400' : 'text-slate-300'}`}>
                    {r.good && '✓ '}{r.tex}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SlideWrapper>
  );
}

function SlideInvestorAccess() {
  const tiers = [
    { icon: '👤', title: 'Retail',        from: '$100',     features: ['Any KYC-verified individual', 'Daily trade limits apply', 'Full dividend access', 'Mobile wallet'], color: 'border-blue-700/50 bg-blue-900/10' },
    { icon: '🏢', title: 'Corporate',     from: '$10,000',  features: ['Registered companies', 'Bulk subscription', 'Priority allocation', 'Reporting suite'], color: 'border-yellow-700/50 bg-yellow-900/10' },
    { icon: '🏦', title: 'Institutional', from: '$100,000', features: ['Funds, banks, insurers', 'White-glove onboarding', 'Custom deal flow', 'Off-platform settlement'], color: 'border-purple-700/50 bg-purple-900/10' },
    { icon: '🌍', title: 'Diaspora',      from: '$50',      features: ['Global KYC accepted', 'USDC deposits via Binance', 'Same rights as locals', 'Invest from abroad'], color: 'border-green-700/50 bg-green-900/10' },
  ];
  return (
    <SlideWrapper>
      <div className="max-w-5xl w-full">
        <SlideTag>Investor Base</SlideTag>
        <SlideTitle>Four Investor Tiers.<br /><Gold>One Platform.</Gold></SlideTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map(t => (
            <div key={t.title} className={`rounded-2xl border p-5 ${t.color}`}>
              <div className="text-3xl mb-3">{t.icon}</div>
              <div className="text-white font-bold text-lg mb-1">{t.title}</div>
              <div className="text-yellow-400 font-semibold text-sm mb-4">From {t.from}</div>
              <ul className="space-y-1">
                {t.features.map(f => (
                  <li key={f} className="text-slate-300 text-xs flex items-start gap-1.5">
                    <span className="text-green-400 mt-0.5">✓</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <p className="text-slate-400 text-sm">Combined addressable investor base: <Gold>342+ registered &amp; growing</Gold></p>
        </div>
      </div>
    </SlideWrapper>
  );
}

function SlideRegulatory() {
  const items = [
    { icon: '🏛️', title: 'SECZ Innovation Hub Sandbox',    desc: 'Licensed and supervised by the Securities and Exchange Commission of Zimbabwe. Legitimate regulatory framework for digital asset issuance.' },
    { icon: '📜', title: 'Finance Act 2025 — SEC Amendment', desc: 'Zimbabwe\'s Finance Act 2025 explicitly enables blockchain-based securities. We operate within its defined parameters.' },
    { icon: '🌐', title: 'IOSCO 38 Principles',             desc: 'Platform architecture designed to meet all 38 IOSCO principles for securities market regulation.' },
    { icon: '🔒', title: 'Smart Contract Audit',            desc: 'All deployed contracts independently audited. Code is open source and verifiable on Polygonscan.' },
    { icon: '🪪', title: 'KYC/AML Compliant',              desc: 'Every investor and issuer verified. Sanctions screening, PEP checks, and document verification via approved providers.' },
    { icon: '📋', title: 'Full Audit Trail',                desc: 'Every transaction, vote, and distribution permanently recorded on-chain and in our PostgreSQL audit log.' },
  ];
  return (
    <SlideWrapper>
      <div className="max-w-5xl w-full">
        <SlideTag>Regulatory Framework</SlideTag>
        <SlideTitle>Built on Solid<br /><Gold>Legal Foundations</Gold></SlideTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(item => (
            <div key={item.title} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex gap-4">
              <span className="text-2xl shrink-0 mt-0.5">{item.icon}</span>
              <div>
                <div className="text-white font-semibold text-sm mb-1">{item.title}</div>
                <div className="text-slate-400 text-xs leading-relaxed">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideWrapper>
  );
}

function SlideAssetClasses() {
  const assets = [
    { icon: '📈', label: 'Private Equity',    desc: 'Tokenised shares in private companies. Participate in growth from day one.', eg: 'e.g. Tech, Agri, Manufacturing' },
    { icon: '🏢', label: 'Real Estate',        desc: 'Commercial property REITs and SPVs. Earn rental income as token distributions.', eg: 'e.g. Harare CBD, Bulawayo REIT' },
    { icon: '⛏️', label: 'Mining & PGMs',    desc: 'Platinum group metals, gold, base metals. Zimbabwe\'s vast mineral wealth tokenised.', eg: 'e.g. Great Dyke, Zimplats exposure' },
    { icon: '🔌', label: 'Infrastructure',    desc: 'Toll roads, energy, telecoms. Long-term concession revenue as fixed distributions.', eg: 'e.g. Solar, logistics, broadband' },
    { icon: '📜', label: 'Bonds',              desc: 'Fixed-income infrastructure and corporate bonds. Predictable coupon payments.', eg: 'e.g. 8–12% p.a. ZiG-denominated' },
    { icon: '🌱', label: 'Agriculture',       desc: 'Farmland and agri-processing tokens. Zimbabwe\'s productive sector, tokenised.', eg: 'e.g. Tobacco, horticulture SPVs' },
  ];
  return (
    <SlideWrapper>
      <div className="max-w-5xl w-full">
        <SlideTag>Asset Classes</SlideTag>
        <SlideTitle>Six Asset Classes.<br /><Gold>One Ecosystem.</Gold></SlideTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {assets.map(a => (
            <div key={a.label} className="bg-slate-800/60 border border-slate-700 hover:border-yellow-600/50 rounded-2xl p-5 transition-colors">
              <div className="text-3xl mb-3">{a.icon}</div>
              <div className="text-white font-bold text-base mb-1.5">{a.label}</div>
              <div className="text-slate-400 text-xs leading-relaxed mb-2">{a.desc}</div>
              <div className="text-yellow-600 text-xs">{a.eg}</div>
            </div>
          ))}
        </div>
      </div>
    </SlideWrapper>
  );
}

function SlideTechnology() {
  const layers = [
    { layer: 'Frontend',    tech: 'Next.js 16 + Tailwind CSS',        note: 'Server & client rendering, real-time updates' },
    { layer: 'Blockchain',  tech: 'Polygon (MATIC) + Solidity',        note: 'UUPS proxy contracts, ERC-20 tokens, low gas' },
    { layer: 'Database',    tech: 'PostgreSQL + Supabase',             note: 'ACID-compliant ledger, audit trail, real-time' },
    { layer: 'Auth & KYC',  tech: 'JWT + KYC provider',               note: 'Role-based access, KYC expiry tracking' },
    { layer: 'Settlement',  tech: 'USDC ERC-20 + Omnibus wallet',      note: 'Fiat on-ramp → USDC → on-chain settlement' },
    { layer: 'Oracles',     tech: 'Valuation Oracle (Solidity)',       note: 'Auditor-certified price feeds, 6-decimal precision' },
    { layer: 'Compliance',  tech: 'ComplianceRegistry + KYCManager',  note: 'On-chain whitelist, sanctions, PEP checks' },
    { layer: 'Hosting',     tech: 'Render (API) + Vercel (Web)',       note: 'Auto-scaling, CI/CD, global CDN' },
  ];
  return (
    <SlideWrapper>
      <div className="max-w-4xl w-full">
        <SlideTag>Technology</SlideTag>
        <SlideTitle>Institutional-Grade<br /><Gold>Infrastructure</Gold></SlideTitle>
        <div className="space-y-2">
          {layers.map(l => (
            <div key={l.layer} className="flex items-center gap-4 bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3">
              <div className="w-28 shrink-0 text-slate-500 text-xs font-semibold uppercase tracking-wide">{l.layer}</div>
              <div className="flex-1 text-white text-sm font-medium">{l.tech}</div>
              <div className="hidden md:block text-slate-400 text-xs text-right">{l.note}</div>
            </div>
          ))}
        </div>
      </div>
    </SlideWrapper>
  );
}

function SlideFees() {
  const rows = [
    { item: 'Application fee',        tex: '$500 (one-time)',     trad: '$5,000–$50,000', highlight: false },
    { item: 'Issuance fee',            tex: '1.5% of raise',      trad: '3–5% of raise',  highlight: false },
    { item: 'Annual SPV listing fee',  tex: '$2,500/year',        trad: '$50,000+/year',  highlight: false },
    { item: 'Compliance audit',        tex: 'Facilitated (cost varies)', trad: '$30,000+', highlight: false },
    { item: 'Trading fee (per trade)', tex: '0.5%',               trad: '1–1.5%',         highlight: false },
    { item: 'IMTT (withdrawal)',       tex: '2% (statutory)',     trad: '2% (same)',       highlight: false },
    { item: 'Dividend distribution',   tex: 'Automated, $0 extra', trad: '$5,000–$15,000/event', highlight: true },
    { item: 'Investor reach',          tex: 'Retail + Inst. + Diaspora', trad: 'Institutional only', highlight: true },
  ];
  return (
    <SlideWrapper>
      <div className="max-w-4xl w-full">
        <SlideTag>Fee Structure</SlideTag>
        <SlideTitle>Transparent Costs.<br /><Gold>No Surprises.</Gold></SlideTitle>
        <div className="overflow-x-auto rounded-2xl border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800 border-b border-slate-700">
                <th className="text-left py-3 px-5 text-slate-400 font-medium">Fee Item</th>
                <th className="text-center py-3 px-5 text-yellow-400 font-semibold">TokenEquityX</th>
                <th className="text-center py-3 px-5 text-slate-400 font-medium">Traditional</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.item} className={`border-b border-slate-800 ${i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/30'}`}>
                  <td className="py-3 px-5 text-white font-medium">{r.item}</td>
                  <td className={`py-3 px-5 text-center font-semibold ${r.highlight ? 'text-green-400' : 'text-white'}`}>{r.tex}</td>
                  <td className="py-3 px-5 text-center text-slate-400">{r.trad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-slate-500 text-center">All fees in USD. IMTT is a statutory Zimbabwean tax collected on behalf of ZIMRA.</p>
      </div>
    </SlideWrapper>
  );
}

function SlideCaseStudy() {
  const metrics = [
    { label: 'Raise Target',      value: '$2,000,000', icon: '🎯' },
    { label: 'Time to Live',      value: '7 weeks',    icon: '⏱️' },
    { label: 'Total Cost',        value: '$31,000',    icon: '💰' },
    { label: 'Investors Reached', value: '342',        icon: '👥' },
    { label: 'Token Price',       value: '$1.00',      icon: '🪙' },
    { label: 'Secondary Price',   value: '$1.08 (+8%)', icon: '📈' },
  ];
  return (
    <SlideWrapper>
      <div className="max-w-5xl w-full">
        <SlideTag>Case Study</SlideTag>
        <SlideTitle><Gold>Harare Tech Co</Gold> — $2M Raise<br /><span className="text-2xl text-slate-400 font-normal">A fictional illustrative example</span></SlideTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {metrics.map(m => (
            <div key={m.label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">{m.icon}</div>
              <div className="text-xl font-bold text-yellow-400 mb-1">{m.value}</div>
              <div className="text-slate-400 text-xs">{m.label}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4">
            <p className="text-red-300 text-xs font-semibold mb-2">WITHOUT TOKENEQUITYX</p>
            <ul className="text-slate-300 text-sm space-y-1">
              <li>✗ ZSE: minimum $5M raise required</li>
              <li>✗ 18–24 months to list</li>
              <li>✗ $150,000–$200,000 in fees</li>
              <li>✗ Only 10–15 institutional investors</li>
              <li>✗ No diaspora access</li>
            </ul>
          </div>
          <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4">
            <p className="text-green-300 text-xs font-semibold mb-2">WITH TOKENEQUITYX</p>
            <ul className="text-slate-300 text-sm space-y-1">
              <li>✓ $100K minimum raise threshold</li>
              <li>✓ Live in 7 weeks</li>
              <li>✓ $31,000 total cost (85% saving)</li>
              <li>✓ 342 investors — retail + diaspora</li>
              <li>✓ Dividend distributed automatically</li>
            </ul>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

function SlideNextSteps() {
  const steps = [
    { n: 1, title: 'Book a 30-min call',        desc: 'No-commitment introductory call with Richard or Leo.' },
    { n: 2, title: 'Submit application',         desc: '$500 fee · 2-page application form · company documents.' },
    { n: 3, title: 'KYC/AML & audit phase',      desc: '2–4 weeks · entity verification · certified auditor assigned.' },
    { n: 4, title: 'Token creation & raise',     desc: '4–8 weeks · smart contract deployed · subscriptions open.' },
    { n: 5, title: 'Live on secondary market',   desc: '24/7 trading · automatic dividends · real-time reporting.' },
  ];
  return (
    <SlideWrapper>
      <div className="max-w-5xl w-full">
        <SlideTag>Next Steps</SlideTag>
        <SlideTitle>Ready to Raise?<br /><Gold>Here&apos;s How to Start.</Gold></SlideTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            {steps.map(s => (
              <div key={s.n} className="flex gap-4 items-start bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                <div className="w-8 h-8 shrink-0 rounded-full bg-yellow-500 text-slate-900 text-sm font-black flex items-center justify-center">{s.n}</div>
                <div>
                  <div className="text-white font-semibold text-sm">{s.title}</div>
                  <div className="text-slate-400 text-xs mt-0.5">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 text-center flex-1">
              <div className="text-4xl mb-4">📅</div>
              <div className="text-white font-bold text-lg mb-2">Book a Demo</div>
              <div className="text-slate-300 text-sm mb-4">30-minute walkthrough of the platform. No commitment required.</div>
              <a href="mailto:richard@tokenequityx.co.zw?subject=TokenEquityX Demo Request"
                className="inline-block bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">
                Book a Call →
              </a>
            </div>
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 space-y-2">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">Contact</div>
              {[
                { icon: '📧', text: 'richard@tokenequityx.co.zw' },
                { icon: '🌐', text: 'tokenequityx.co.zw' },
                { icon: '📍', text: 'SECZ Innovation Hub, Harare, Zimbabwe' },
              ].map(c => (
                <div key={c.text} className="flex items-center gap-2 text-sm text-slate-300">
                  <span>{c.icon}</span><span>{c.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

function SlideTeam() {
  const team = [
    {
      name: 'Richard Chimuka',
      role: 'CEO & Co-Founder',
      bio: 'Capital markets strategist with deep experience in Zimbabwean financial services. Leads business development, regulatory relations, and issuer partnerships.',
      contact: 'richard@tokenequityx.co.zw',
      initials: 'RC',
      color: 'bg-blue-700',
    },
    {
      name: 'Leo Gaviao',
      role: 'CTO & Co-Founder',
      bio: 'Full-stack blockchain developer. Architected the TokenEquityX platform from smart contracts to UI. Expert in DeFi protocols, Solidity, and institutional fintech.',
      contact: 'leomgaviao@tokenequityx.co.zw',
      initials: 'LG',
      color: 'bg-yellow-600',
    },
  ];
  return (
    <SlideWrapper>
      <div className="max-w-4xl w-full">
        <SlideTag>The Team</SlideTag>
        <SlideTitle>Built by <Gold>Operators</Gold>,<br />Not Just Technologists</SlideTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {team.map(t => (
            <div key={t.name} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
              <div className={`w-16 h-16 rounded-full ${t.color} flex items-center justify-center text-white text-2xl font-black mb-4`}>
                {t.initials}
              </div>
              <div className="text-white font-bold text-xl mb-1">{t.name}</div>
              <div className="text-yellow-400 font-medium text-sm mb-4">{t.role}</div>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">{t.bio}</p>
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <span>📧</span><span>{t.contact}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
          <p className="text-slate-300 text-sm mb-4">
            TokenEquityX operates under the <strong className="text-white">SECZ Innovation Hub Sandbox</strong> —
            Africa&apos;s most forward-thinking capital markets regulatory framework.
          </p>
          <div className="flex justify-center gap-6 text-sm">
            <span className="text-yellow-400 font-semibold">🌐 tokenequityx.co.zw</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-300">Harare, Zimbabwe</span>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// ── Slide registry ─────────────────────────────────────────────────────────────

const SLIDE_COMPONENTS = [
  SlideTitle1, SlideProblem, SlideSolution, SlideHowItWorks,
  SlideIssuerValue, SlideInvestorAccess, SlideRegulatory, SlideAssetClasses,
  SlideTechnology, SlideFees, SlideCaseStudy, SlideNextSteps, SlideTeam,
];

const SLIDE_LABELS = [
  'Title', 'Problem', 'Solution', 'How It Works',
  'Issuer Value', 'Investor Access', 'Regulatory', 'Asset Classes',
  'Technology', 'Fees', 'Case Study', 'Next Steps', 'Team',
];

// ── Main deck component ────────────────────────────────────────────────────────

export default function IssuerDeck() {
  const [current, setCurrent] = useState(0);
  const [animDir, setAnimDir] = useState('next');
  const [animating, setAnimating] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const total = SLIDES.length;

  const goTo = useCallback((idx) => {
    if (idx < 0 || idx >= total || animating) return;
    setAnimDir(idx > current ? 'next' : 'prev');
    setAnimating(true);
    setTimeout(() => {
      setCurrent(idx);
      setAnimating(false);
    }, 350);
  }, [current, total, animating]);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')                    { e.preventDefault(); prev(); }
      if (e.key === 'Home') goTo(0);
      if (e.key === 'End')  goTo(total - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, goTo, total]);

  // Touch / swipe
  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      dx > 0 ? next() : prev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const CurrentSlide = SLIDE_COMPONENTS[current];

  return (
    <>
      {/* ── Print styles ── */}
      <style>{`
        @media print {
          body { background: #0f172a !important; color: white !important; }
          .no-print { display: none !important; }
          .print-slide { page-break-after: always; height: 100vh; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>

      {/* ── Screen deck ── */}
      <div
        className="fixed inset-0 bg-slate-900 overflow-hidden no-print"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800 z-20">
          <div
            className="h-full bg-yellow-500 transition-all duration-500 ease-out"
            style={{ width: `${((current + 1) / total) * 100}%` }}
          />
        </div>

        {/* Top bar */}
        <div className="absolute top-3 left-0 right-0 z-20 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 font-black text-lg hidden md:block">TEX</span>
            <span className="text-slate-500 text-xs hidden md:block">|</span>
            <span className="text-slate-400 text-xs hidden md:block">{SLIDE_LABELS[current]}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-sm">{current + 1} / {total}</span>
            <button
              onClick={() => window.print()}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs transition-colors"
              title="Print / Save as PDF"
            >
              <span>🖨️</span><span>PDF</span>
            </button>
          </div>
        </div>

        {/* Dot navigation */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 no-print">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? 'w-6 h-2 bg-yellow-500'
                  : 'w-2 h-2 bg-slate-600 hover:bg-slate-400'
              }`}
              title={SLIDE_LABELS[i]}
            />
          ))}
        </div>

        {/* Prev button */}
        <button
          onClick={prev}
          disabled={current === 0}
          className="no-print absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed"
        >
          ‹
        </button>

        {/* Next button */}
        <button
          onClick={next}
          disabled={current === total - 1}
          className="no-print absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed"
        >
          ›
        </button>

        {/* Slide content */}
        <div
          className={`absolute inset-0 pt-10 pb-14 transition-all duration-350 ease-in-out ${
            animating
              ? animDir === 'next'
                ? '-translate-x-8 opacity-0'
                : 'translate-x-8 opacity-0'
              : 'translate-x-0 opacity-100'
          }`}
        >
          <CurrentSlide />
        </div>

        {/* Keyboard hint */}
        <div className="no-print absolute bottom-6 right-6 text-slate-700 text-xs hidden md:block">
          ← → navigate · Space next
        </div>
      </div>

      {/* ── Print-only: all slides stacked ── */}
      <div className="print-only">
        {SLIDE_COMPONENTS.map((SlideComp, i) => (
          <div key={i} className="print-slide bg-slate-900" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <SlideComp />
          </div>
        ))}
      </div>
    </>
  );
}
