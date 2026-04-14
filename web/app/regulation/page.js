'use client';
import { useRouter } from 'next/navigation';

const NAVY='#1A3C5E', GOLD='#C8972B';

export default function RegulationPage() {
  const router=useRouter();
  return(
    <div className="min-h-screen bg-gray-950 text-white pt-20">
      <section className="py-24 px-6 border-b border-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block text-xs uppercase tracking-[0.3em] text-gray-500 mb-6 border border-gray-800 px-4 py-2 rounded-full">Regulation</span>
          <h1 className="text-5xl md:text-6xl font-black mb-6">Regulated.<br/><span style={{color:GOLD}}>Protected. Compliant.</span></h1>
          <p className="text-gray-400 text-xl">TokenEquityX operates under full regulatory oversight of the Securities and Exchange Commission of Zimbabwe. Every transaction, every investor, every listing — compliant.</p>
        </div>
      </section>

      {/* SECZ */}
      <section id="secz" className="py-20 px-6 border-b border-gray-800">
        <div className="max-w-screen-xl mx-auto grid grid-cols-1 xl:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-4 block">Regulator</span>
            <h2 className="text-3xl font-black mb-6">SECZ Innovation Hub Sandbox</h2>
            <div className="space-y-4 text-gray-400 leading-relaxed">
              <p>TokenEquityX is applying for designation under the <strong className="text-white">Securities and Exchange Commission of Zimbabwe (SECZ) Innovation Hub Regulatory Sandbox</strong>.</p>
              <p>The Innovation Hub is SECZ's framework for supervised operation of fintech companies that introduce novel financial products or services. Sandbox designation allows TokenEquityX to operate within defined parameters while the full regulatory framework for digital asset securities is developed.</p>
              <p>Sandbox parameters include a maximum daily trading volume of USD 50,000, a maximum of 50 investors during the pilot phase, and a cap of USD 2 million per individual asset issuance.</p>
            </div>
            <div className="mt-6 flex items-center gap-3 bg-green-900/20 border border-green-800/50 rounded-xl px-4 py-3">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"/>
              <span className="text-green-300 text-sm font-semibold">Sandbox Application Active — Under SECZ Review</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="font-bold mb-4">Sandbox Operating Parameters</h3>
              <div className="space-y-3">
                {[
                  ['Maximum Daily Trading Volume','USD 50,000 across all assets'],
                  ['Maximum Investors (Pilot Phase)','50 KYC-verified investors'],
                  ['Maximum Single Asset Issuance','USD 2,000,000 per offering'],
                  ['Duration','12 months (renewable)'],
                  ['Reporting Frequency','Quarterly to SECZ'],
                  ['Primary Contact','Chenai N. Moyo, SECZ'],
                ].map(([k,v],i)=>(
                  <div key={i} className="flex justify-between text-sm border-b border-gray-800/50 pb-2 last:border-0 last:pb-0">
                    <span className="text-gray-400">{k}</span>
                    <span className="font-semibold text-right ml-4">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KYC */}
      <section id="kyc" className="py-20 px-6 border-b border-gray-800" style={{background:'linear-gradient(to bottom,transparent,#0d111a,transparent)'}}>
        <div className="max-w-screen-xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-4 block">Compliance</span>
            <h2 className="text-3xl font-black">KYC / AML Policy</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[
              {icon:'🔍',title:'Identity Verification',desc:'All investors and issuers must submit government-issued photo ID, proof of address, and — for entities — company registration documents and beneficial ownership declaration.'},
              {icon:'🛡️',title:'AML Screening',desc:'All applicants are screened against international sanctions lists, Politically Exposed Persons (PEP) databases, and adverse media sources prior to onboarding.'},
              {icon:'📊',title:'Investor Classification',desc:'Investors are classified as Retail, Accredited, Institutional, or Family Office based on income, net worth, and investment experience — determining applicable limits.'},
              {icon:'🔄',title:'Ongoing Monitoring',desc:'All transactions are monitored for unusual patterns. Suspicious transactions are reported to Zimbabwe\'s Financial Intelligence Unit (FIU) as required by law.'},
              {icon:'📅',title:'Annual Refresh',desc:'KYC records are refreshed annually. Investors who do not complete their annual review have their accounts suspended until compliant.'},
              {icon:'⚖️',title:'Compliance Officer',desc:'A qualified Compliance Officer reviews all KYC submissions before approval. No automated approval — every application has human oversight.'},
            ].map((c,i)=>(
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <span className="text-3xl mb-3 block">{c.icon}</span>
                <h3 className="font-bold mb-2">{c.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INVESTOR PROTECTION */}
      <section id="protection" className="py-20 px-6 border-b border-gray-800">
        <div className="max-w-screen-xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-4 block">Safeguards</span>
            <h2 className="text-3xl font-black">Investor Protection</h2>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="space-y-4">
              {[
                {title:'Smart Contract Audit',desc:'All 11 platform smart contracts are independently audited by Certik or Hacken prior to mainnet deployment. Audit reports are publicly available.'},
                {title:'SPV Asset Ring-Fencing',desc:'Each listed asset is held in a separately registered Special Purpose Vehicle. Issuer insolvency cannot affect tokenised asset holders — their claim is against the SPV.'},
                {title:'Oracle Price Integrity',desc:'Asset prices are set exclusively by ICAZ-qualified independent valuers using documented methodology. No algorithmic or market-manipulable pricing.'},
                {title:'Circuit Breakers',desc:'Automated trading halts trigger if an asset price moves more than 10% in a single session. This prevents flash crashes and manipulation.'},
                {title:'Escrow Distribution',desc:'Dividend and coupon payments are pre-funded into the DividendDistributor smart contract before distribution. Investors can claim at any time — funds cannot be recalled.'},
              ].map((p,i)=>(
                <div key={i} className="flex items-start gap-4 bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <span className="text-green-400 text-lg mt-0.5">✓</span>
                  <div><p className="font-bold text-sm">{p.title}</p><p className="text-gray-400 text-xs mt-1 leading-relaxed">{p.desc}</p></div>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="font-bold mb-4">Risk Disclosures</h3>
                <div className="space-y-3 text-sm text-gray-400 leading-relaxed">
                  <p className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-3 text-amber-300 text-xs">⚠️ Investing in tokenised assets carries risk. You may lose some or all of your invested capital.</p>
                  <p>TokenEquityX does not guarantee investment returns. Past performance of listed assets is not indicative of future results. All investment decisions should be based on your own research and risk appetite.</p>
                  <p>Mining equity tokens (ACME, GDMR) carry higher risk than income-bearing assets (ZWIB, HCPR) and are classified as MEDIUM-HIGH to HIGH risk by our independent research team.</p>
                  <p>All investors should read the full prospectus for each listed asset before investing. Prospectuses are available in the Documents section of each asset's detail page.</p>
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="font-bold mb-3">Custody & Legal Structure</h3>
                <p className="text-gray-400 text-sm leading-relaxed">Tokenised assets are not direct ownership of the underlying physical asset. Token holders hold a beneficial interest in the SPV that owns the asset. The SPV structure provides legal ring-fencing and is registered with the Zimbabwe Registrar of Companies.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DISCLOSURE */}
      <section id="disclosure" className="py-20 px-6 border-b border-gray-800">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black mb-4">Disclosure Rules</h2>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h3 className="font-bold mb-4">Issuer Ongoing Disclosure Requirements</h3>
            <div className="space-y-3">
              {[
                {freq:'Quarterly',req:'Financial data submission — revenue, EBITDA, assets, liabilities, and key operational metrics.'},
                {freq:'Quarterly',req:'Management statement — operational update, material developments, distribution announcements.'},
                {freq:'Immediately',req:'Material price-sensitive information — merger, acquisition, significant contract, major litigation.'},
                {freq:'Annually',req:'Audited financial statements reviewed by a Zimbabwe-registered auditor.'},
                {freq:'Annually',req:'AGM notice and resolution results published to all token holders.'},
                {freq:'On Event',req:'Change in directors, beneficial ownership, or SPV structure must be disclosed within 48 hours.'},
              ].map((d,i)=>(
                <div key={i} className="flex items-start gap-4 border-b border-gray-800/50 pb-3 last:border-0 last:pb-0">
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-900/50 text-blue-300 whitespace-nowrap font-semibold">{d.freq}</span>
                  <p className="text-gray-400 text-sm">{d.req}</p>
                </div>
              ))}
            </div>
            <p className="text-gray-600 text-xs mt-4">Failure to comply with disclosure obligations may result in trading suspension and delisting. All disclosures are published on-chain as immutable metadata.</p>
          </div>
        </div>
      </section>

      {/* COMPLAINTS */}
      <section id="complaints" className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-black mb-6">Complaints Process</h2>
          <p className="text-gray-400 mb-8">If you have a complaint about TokenEquityX, a listed issuer, or a transaction on the platform, follow this process:</p>
          <div className="space-y-4 text-left">
            {[
              {step:'1',title:'Contact TokenEquityX Directly',desc:'Email compliance@tokenequityx.com with full details of your complaint. We will acknowledge within 24 hours and respond within 5 business days.'},
              {step:'2',title:'Escalate to the Compliance Officer',desc:'If unsatisfied with the initial response, escalate to our Compliance Officer at co@tokenequityx.com. Independent review within 10 business days.'},
              {step:'3',title:'Refer to SECZ',desc:'If you remain unsatisfied, you may refer your complaint to the Securities and Exchange Commission of Zimbabwe at www.seczim.co.zw or +263 (0)4 252 177.'},
            ].map((s,i)=>(
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-black flex-shrink-0" style={{background:GOLD,color:'#111'}}>{s.step}</div>
                <div><p className="font-bold mb-1">{s.title}</p><p className="text-gray-400 text-sm">{s.desc}</p></div>
              </div>
            ))}
          </div>
          <button onClick={()=>router.push('/contact')} className="mt-8 px-8 py-3 rounded-xl font-bold text-gray-900 hover:opacity-90" style={{background:GOLD}}>Contact Compliance Team</button>
        </div>
      </section>
    </div>
  );
}
