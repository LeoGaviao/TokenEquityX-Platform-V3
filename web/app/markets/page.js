'use client';
import { useRouter } from 'next/navigation';

const NAVY='#1A3C5E', GOLD='#C8972B', GREEN='#16a34a', TEAL='#0891b2';

const SERVICES=[
  {id:'issuance',icon:'🏢',title:'Asset Tokenisation & Issuance',color:NAVY,
   desc:'Transform any productive asset into a tradeable digital token. Our end-to-end issuance service handles everything from SPV setup to SECZ approval.',
   features:['SPV registration and legal structuring','Independent asset valuation','KYC/AML compliance for all directors','Smart contract deployment on Polygon','SECZ sandbox listing approval','Investor prospectus preparation'],
   fee:'0.25% of total raise value',
   timeline:'30–60 days from application to listing'},
  {id:'trading',icon:'🔄',title:'Secondary Market Trading',color:GREEN,
   desc:'A fully regulated secondary market where investors can buy and sell tokenised assets — any time, from anywhere, with instant settlement.',
   features:['Order book matching engine','Market and limit orders','Real-time price discovery','USDC settlement in seconds','KYC-gated — all counterparties verified','Circuit breakers and market protection'],
   fee:'0.50% per matched trade (both sides)',
   timeline:'Available immediately upon investor KYC approval'},
  {id:'dividends',icon:'💰',title:'Distribution & Income Services',color:GOLD,
   desc:'Automated distribution of income to token holders — rental income, bond coupons, mining royalties — directly to investor wallets.',
   features:['On-chain dividend distribution contracts','Automatic snapshot of eligible holders','Pull-based claiming (no gas risk)','Quarterly or custom schedules','Full audit trail of every distribution','USDC direct to investor wallet'],
   fee:'No additional fee — included in platform fee',
   timeline:'Distributions execute within 24 hours of funding'},
  {id:'kyc',icon:'🔍',title:'KYC & Compliance Services',color:TEAL,
   desc:'Full Know Your Customer and Anti-Money Laundering verification for all platform participants, aligned to FATF standards and Zimbabwe FIU requirements.',
   features:['Identity document verification','Beneficial ownership checks','PEP and sanctions screening','Ongoing monitoring and annual refresh','Investor classification (retail/accredited/institutional)','Compliance officer review and sign-off'],
   fee:'USD 50 per investor (one-time)',
   timeline:'24–48 hours for standard applications'},
  {id:'whitelabel',icon:'🏷️',title:'White-Label Platform Licensing',color:'#7c3aed',
   desc:'Deploy a fully branded digital capital markets platform for your bank, exchange, or financial institution. Powered by TokenEquityX infrastructure.',
   features:['Full platform white-labelling','Custom branding and domain','API integration with existing systems','Dedicated compliance officer support','Ongoing technical maintenance','Regulatory guidance for your jurisdiction'],
   fee:'USD 100,000+ per year depending on scope',
   timeline:'3–6 months for full deployment'},
  {id:'api',icon:'🔌',title:'Data & API Access',color:'#db2777',
   desc:'Institutional-grade market data feeds for DeFi protocols, research firms, and financial institutions seeking exposure to African tokenised asset data.',
   features:['REST API — prices, volumes, yields','WebSocket real-time event stream','Oracle price history and methodology','Order book depth data','Settlement and blockchain metrics','Custom data packages available'],
   fee:'From USD 500/month (institutional)',
   timeline:'API key issued within 24 hours of approval'},
];

const ASSET_CLASSES=[
  {icon:'🏢',name:'Real Estate / REIT',desc:'Tokenised commercial property income trusts. Earn quarterly rental distributions from Grade-A office, retail, and industrial properties.',yield:'8–12% annual yield',risk:'LOW–MEDIUM',example:'Harare CBD REIT (HCPR)'},
  {icon:'⛏️',name:'Mining & PGMs',desc:'Equity tokens in platinum group metal, gold, and base metal producers. Exposure to Zimbabwe\'s vast mineral endowment.',yield:'Capital appreciation',risk:'MEDIUM–HIGH',example:'Acme Mining Ltd (ACME)'},
  {icon:'📜',name:'Infrastructure Bonds',desc:'Fixed-income bonds financing roads, energy, and telecoms infrastructure. Government-backed or revenue-secured.',yield:'7–10% fixed coupon',risk:'LOW–MEDIUM',example:'ZimInfra Bond 2027 (ZWIB)'},
  {icon:'🔌',name:'Infrastructure Equity',desc:'Equity in concession-backed infrastructure assets. Long-term, predictable cash flows from toll roads, solar energy, and telecoms.',yield:'8–15% target IRR',risk:'MEDIUM',example:'Launching soon'},
  {icon:'📈',name:'Private Equity',desc:'Tokenised shares in high-growth Zimbabwean private companies. Participate in equity upside from day one.',yield:'Growth — no fixed yield',risk:'HIGH',example:'Launching soon'},
  {icon:'🌱',name:'Agriculture',desc:'Farmland tokens and agri-processing equity. Exposure to Zimbabwe\'s productive agricultural sector.',yield:'Variable',risk:'MEDIUM–HIGH',example:'Launching 2026'},
];

export default function MarketsPage() {
  const router=useRouter();
  return(
    <div className="min-h-screen bg-gray-950 text-white pt-20">
      <section className="py-24 px-6 border-b border-gray-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{backgroundImage:`linear-gradient(${NAVY} 1px,transparent 1px),linear-gradient(90deg,${NAVY} 1px,transparent 1px)`,backgroundSize:'60px 60px'}}/>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <span className="inline-block text-xs uppercase tracking-[0.3em] text-gray-500 mb-6 border border-gray-800 px-4 py-2 rounded-full">Services</span>
          <h1 className="text-5xl md:text-6xl font-black leading-tight mb-6">Everything You Need to<br/><span style={{color:GOLD}}>List, Trade & Earn</span></h1>
          <p className="text-gray-400 text-xl leading-relaxed">From asset tokenisation to secondary trading, dividend distribution to regulatory compliance — TokenEquityX provides the complete infrastructure for Africa's digital capital market.</p>
        </div>
      </section>

      {/* SERVICES */}
      <section className="py-20 px-6 border-b border-gray-800">
        <div className="max-w-screen-xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">Platform Services</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Six core services powering Africa's tokenised asset marketplace.</p>
          </div>
          <div className="space-y-6">
            {SERVICES.map((s,i)=>(
              <div key={i} id={s.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 scroll-mt-24">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  <div className="xl:col-span-2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{background:`${s.color}22`,border:`1px solid ${s.color}44`}}>{s.icon}</div>
                      <h3 className="text-2xl font-black">{s.title}</h3>
                    </div>
                    <p className="text-gray-400 leading-relaxed mb-6">{s.desc}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {s.features.map((f,j)=>(
                        <div key={j} className="flex items-center gap-2 text-sm text-gray-300">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:s.color}}/>
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-gray-800/50 rounded-xl p-4">
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Fee</p>
                      <p className="font-bold text-sm" style={{color:GOLD}}>{s.fee}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-4">
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Timeline</p>
                      <p className="font-semibold text-sm text-white">{s.timeline}</p>
                    </div>
                    <button onClick={()=>router.push('/contact')}
                      className="w-full py-3 rounded-xl font-bold text-sm text-white hover:opacity-90 transition-all"
                      style={{background:s.color}}>
                      Enquire About This Service →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ASSET CLASSES */}
      <section id="asset-classes" className="py-20 px-6 border-b border-gray-800">
        <div className="max-w-screen-xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">Supported Asset Classes</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Every major African asset class — accessible through a single regulated platform.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {ASSET_CLASSES.map((a,i)=>(
              <div key={i} className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl p-6 transition-all">
                <span className="text-4xl mb-4 block">{a.icon}</span>
                <h3 className="font-bold text-lg mb-2">{a.name}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">{a.desc}</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">Expected Return</span><span className="text-green-400 font-semibold">{a.yield}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Risk Profile</span><span className="text-yellow-400 font-semibold">{a.risk}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Live Example</span><span className="text-blue-400 font-semibold">{a.example}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEE SCHEDULE */}
      <section id="fees" className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">Fee Schedule</h2>
            <p className="text-gray-400">Transparent, competitive pricing. No hidden fees.</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-800 bg-gray-800/50"><th className="text-left p-4 font-bold">Service</th><th className="text-left p-4 font-bold">Fee</th><th className="text-left p-4 font-bold">Who Pays</th></tr></thead>
              <tbody>
                {[
                  ['Trading Fee','0.50% per matched trade','Both buyer and seller'],
                  ['Issuance Fee','0.25% of token offer value','Issuer, at listing'],
                  ['Annual Platform Fee','USD 5,000 per asset per year','Issuer'],
                  ['Valuation Service','USD 500 per quarterly submission','Issuer'],
                  ['KYC Onboarding','USD 50 per investor','Investor (one-time)'],
                  ['White-Label Licence','From USD 100,000 per year','Banking/institutional partner'],
                  ['Data API Access','From USD 500 per month','DeFi / institutional subscriber'],
                ].map(([svc,fee,who],i)=>(
                  <tr key={i} className={`border-b border-gray-800/50 ${i%2===0?'':'bg-gray-800/20'}`}>
                    <td className="p-4 font-medium">{svc}</td>
                    <td className="p-4 font-bold" style={{color:GOLD}}>{fee}</td>
                    <td className="p-4 text-gray-400">{who}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-gray-600 text-xs mt-4 text-center">All fees are USD-denominated and settled in USDC. Fee schedule subject to review following SECZ full licence issuance.</p>
        </div>
      </section>

      <section className="py-16 px-6 border-t border-gray-800 text-center">
        <h3 className="text-2xl font-black mb-4">Ready to list your asset or start investing?</h3>
        <div className="flex items-center justify-center gap-4">
          <button onClick={()=>router.push('/#login-section')} className="px-8 py-3 rounded-xl font-bold text-gray-900 hover:opacity-90" style={{background:GOLD}}>Get Started</button>
          <button onClick={()=>router.push('/contact')} className="px-8 py-3 rounded-xl font-bold border border-gray-700 text-white hover:border-gray-500">Contact Us</button>
        </div>
      </section>
    </div>
  );
}
