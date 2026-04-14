// RESOURCES PAGE
'use client';
import { useRouter } from 'next/navigation';
const NAVY='#1A3C5E', GOLD='#C8972B';
export default function ResourcesPage() {
  const router=useRouter();
  return(
    <div className="min-h-screen bg-gray-950 text-white pt-20">
      <section className="py-24 px-6 border-b border-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block text-xs uppercase tracking-[0.3em] text-gray-500 mb-6 border border-gray-800 px-4 py-2 rounded-full">Resources</span>
          <h1 className="text-5xl font-black mb-6">Everything You Need<br/>to <span style={{color:GOLD}}>Get Started</span></h1>
          <p className="text-gray-400 text-xl">Guides, documentation, and research to help you navigate Africa's digital capital market.</p>
        </div>
      </section>

      {/* ── WORKFLOW DIAGRAMS ── */}
      <section id="workflows" className="py-16 px-6 border-b border-gray-800" style={{background:'linear-gradient(to bottom, transparent, #0d111a, transparent)'}}>
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-black mb-2">Platform Workflow Diagrams</h2>
              <p className="text-gray-400 max-w-2xl">Detailed operational workflows prepared for SECZ regulatory submission and internal use. All five core platform processes documented and print-ready.</p>
            </div>
            <button onClick={()=>router.push('/workflows')}
              className="px-6 py-3 rounded-xl font-bold text-gray-900 hover:opacity-90 text-sm flex-shrink-0"
              style={{background:'#C8972B'}}>
              View All Diagrams →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {[
              {id:'funds',     icon:'💰', title:'Investor Funds Flow',     desc:'Deposits, withdrawals, custodial account, reconciliation'},
              {id:'lifecycle', icon:'🏢', title:'Issuer Lifecycle',        desc:'SPV → tokenisation → offering → secondary market'},
              {id:'trade',     icon:'⚙️', title:'Trade Settlement',        desc:'Order matching, fee deduction, atomic settlement'},
              {id:'offering',  icon:'📈', title:'Primary Offering Flow',   desc:'Proposal → review → approval → subscribe → disburse'},
              {id:'distrib',   icon:'💵', title:'Distribution & WHT',      desc:'Dividend calculation, withholding tax, ZIMRA remittance'},
            ].map((d,i)=>(
              <div key={i}
                onClick={()=>router.push(`/workflows#${d.id}`)}
                className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl p-5 cursor-pointer transition-all group">
                <span className="text-3xl mb-3 block">{d.icon}</span>
                <p className="font-bold text-sm mb-1 group-hover:text-yellow-400 transition-colors">{d.title}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{d.desc}</p>
                <p className="text-xs text-blue-400 mt-3 group-hover:text-blue-300">View diagram →</p>
              </div>
            ))}
          </div>
          <div className="mt-6 bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 flex items-start gap-3">
            <span className="text-lg flex-shrink-0">🖨️</span>
            <p className="text-xs text-blue-300 leading-relaxed">
              All diagrams are print-ready and can be saved as PDF directly from the browser. Use the Print button on each diagram page for SECZ or RBZ submission copies.
            </p>
          </div>
        </div>
      </section>

      <section id="investor" className="py-16 px-6 border-b border-gray-800">
        <div className="max-w-screen-xl mx-auto">
          <h2 className="text-3xl font-black mb-8">Investor Guide</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              {title:'Getting Started',desc:'How to create your account, complete KYC, and make your first investment.',icon:'🚀',time:'5 min read'},
              {title:'Understanding Tokenised Assets',desc:'What tokenisation means, how your ownership is protected, and how distributions work.',icon:'📚',time:'8 min read'},
              {title:'Risk & Returns',desc:'How to assess risk, read asset prospectuses, and build a diversified portfolio.',icon:'📊',time:'10 min read'},
              {title:'Trading Guide',desc:'How to place orders, read the order book, and manage your positions.',icon:'🔄',time:'6 min read'},
            ].map((g,i)=>(
              <div key={i} className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl p-6 cursor-pointer transition-all" onClick={()=>router.push('/#login-section')}>
                <span className="text-3xl mb-4 block">{g.icon}</span>
                <h3 className="font-bold mb-2">{g.title}</h3>
                <p className="text-gray-400 text-sm mb-3 leading-relaxed">{g.desc}</p>
                <span className="text-xs text-gray-500">{g.time}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="issuer" className="py-16 px-6 border-b border-gray-800">
        <div className="max-w-screen-xl mx-auto">
          <h2 className="text-3xl font-black mb-8">Issuer Guide</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              {title:'Is Tokenisation Right for You?',desc:'Who can list on TokenEquityX, what asset types qualify, and what the process involves.',icon:'🏢',time:'7 min read'},
              {title:'The Listing Process',desc:'Step-by-step guide from SPV registration to going live — timelines, costs, and requirements.',icon:'📋',time:'12 min read'},
              {title:'Ongoing Obligations',desc:'Your disclosure requirements, quarterly reporting, and ongoing compliance obligations.',icon:'📅',time:'8 min read'},
              {title:'Governance & Distributions',desc:'How to create proposals, manage investor voting, and distribute income to token holders.',icon:'🗳️',time:'6 min read'},
            ].map((g,i)=>(
              <div key={i} className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl p-6 cursor-pointer transition-all" onClick={()=>router.push('/contact#issuer')}>
                <span className="text-3xl mb-4 block">{g.icon}</span>
                <h3 className="font-bold mb-2">{g.title}</h3>
                <p className="text-gray-400 text-sm mb-3 leading-relaxed">{g.desc}</p>
                <span className="text-xs text-gray-500">{g.time}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="whitepaper" className="py-16 px-6 border-b border-gray-800">
        <div className="max-w-screen-xl mx-auto">
          <h2 className="text-3xl font-black mb-8">Technical Documents</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {title:'TokenEquityX Whitepaper V3.0',desc:'Full technical and commercial overview of the platform, architecture, tokenomics, and roadmap.',icon:'📃',size:'3.4 MB PDF',badge:'Latest'},
              {title:'SECZ Business Plan',desc:'The business plan submitted to the Securities and Exchange Commission of Zimbabwe Innovation Hub.',icon:'📋',size:'2.8 MB PDF',badge:'Regulatory'},
              {title:'Financial Model',desc:'Full 5-year financial model with Bear/Base/Bull scenarios. Year 1 target: USD 135K revenue.',icon:'📊',size:'1.2 MB XLSX',badge:'Financial'},
            ].map((d,i)=>(
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-4xl">{d.icon}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300">{d.badge}</span>
                </div>
                <h3 className="font-bold mb-2">{d.title}</h3>
                <p className="text-gray-400 text-sm flex-1 mb-4 leading-relaxed">{d.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-xs">{d.size}</span>
                  <button onClick={()=>router.push('/contact')} className="text-xs text-blue-400 hover:text-blue-300">Request Access →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="faq" className="py-16 px-6 border-b border-gray-800">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              {q:'What is tokenisation?',a:'Tokenisation is the process of representing ownership of a real-world asset — a building, a mine, a bond — as a digital token on a blockchain. Each token represents a proportional share of the asset. Tokens can be bought, sold, and transferred instantly, making previously illiquid assets tradeable.'},
              {q:'Is my investment safe?',a:'Each asset is held in a legally registered Special Purpose Vehicle (SPV) that is ring-fenced from the issuer\'s other assets. Your token represents a beneficial interest in the SPV. Smart contracts are independently audited and all transactions are immutable on the Polygon blockchain.'},
              {q:'How do I receive dividends or coupons?',a:'Distributions are sent directly to your wallet address in USDC. The platform uses a "pull" model — funds are pre-deposited into a smart contract and you claim them when convenient. You\'ll receive a notification when a distribution is available.'},
              {q:'What is the minimum investment?',a:'There is no formal minimum investment — you can purchase as few tokens as you wish. The minimum transaction value is determined by the platform\'s trading fee structure (0.50% per trade). We recommend a minimum of USD 100 per transaction for cost-effectiveness.'},
              {q:'How long does KYC take?',a:'Standard KYC applications are reviewed within 24–48 hours. Institutional applications (companies, trusts, family offices) may take 3–5 business days due to enhanced due diligence requirements.'},
              {q:'Can I withdraw my investment?',a:'Yes — you can sell your tokens on the secondary market at any time during trading hours. Settlement is in USDC and typically takes seconds. Liquidity depends on available buyers in the order book.'},
            ].map((f,i)=>(
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-bold mb-2">{f.q}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="glossary" className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black mb-8">Glossary</h2>
          <div className="space-y-3">
            {[
              {term:'SPV',def:'Special Purpose Vehicle — a legally separate entity created to hold a specific asset, ring-fencing it from the issuer\'s other assets and liabilities.'},
              {term:'Oracle Price',def:'The certified market price for a token, set by an independent ICAZ-qualified auditor using a documented valuation model.'},
              {term:'USDC',def:'USD Coin — a USD-denominated stablecoin issued by Circle. All TokenEquityX transactions settle in USDC.'},
              {term:'KYC',def:'Know Your Customer — the identity verification process required before an investor or issuer can use the platform.'},
              {term:'SECZ',def:'Securities and Exchange Commission of Zimbabwe — the primary financial markets regulator in Zimbabwe.'},
              {term:'Circuit Breaker',def:'An automated mechanism that halts trading if an asset price moves more than 10% in a single session.'},
              {term:'TWAP',def:'Time-Weighted Average Price — a price calculation method that averages prices over a time period to smooth out manipulation.'},
              {term:'PGMs',def:'Platinum Group Metals — a group of six metallic elements including platinum, palladium, rhodium, iridium, osmium, and ruthenium, found abundantly in Zimbabwe\'s Great Dyke.'},
            ].map((g,i)=>(
              <div key={i} className="flex gap-4 border-b border-gray-800/50 pb-3 last:border-0">
                <span className="font-black text-sm w-20 flex-shrink-0" style={{color:GOLD}}>{g.term}</span>
                <p className="text-gray-400 text-sm leading-relaxed">{g.def}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
