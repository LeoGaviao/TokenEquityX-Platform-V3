'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

const NAVY='#1A3C5E', GOLD='#C8972B';

const TEAM=[
  {name:'Richard Chimuka',role:'Chief Executive Officer',bio:'Former senior banker with 15+ years in corporate finance and capital markets across Zimbabwe and the SADC region. Richard leads regulatory engagement, strategic partnerships, and commercial operations.',initials:'RC',color:'#1A3C5E'},
  {name:'Leo Gaviao',role:'Director, Technology & Innovation',bio:'Technology architect and sustainability consultant specialising in blockchain infrastructure and digital financial systems. Leo leads platform architecture, smart contract development, and technology partnerships across Southern and Eastern Africa.',initials:'LG',color:'#C8972B'},
];

const MILESTONES=[
  {year:'2024',title:'Company Founded',desc:'TokenEquityX Ltd incorporated in Harare, Zimbabwe. Platform concept developed in response to the USD 42 billion African SME funding gap.'},
  {year:'Q1 2025',title:'Platform V1 Built',desc:'Full smart contract suite developed on Polygon. 11 contracts deployed, 42 unit tests passing. Backend API and investor/issuer dashboards completed.'},
  {year:'Q3 2025',title:'V3 Platform Launch',desc:'Production-ready platform with 5 user roles, institutional-grade dashboards, and USDC settlement infrastructure.'},
  {year:'Q1 2026',title:'SECZ Application',desc:'Formal application submitted to Securities and Exchange Commission of Zimbabwe Innovation Hub for regulatory sandbox designation.'},
  {year:'2026',title:'Sandbox Operations',desc:'Target: 10 listed assets, 500 investors, USD 135K Year 1 revenue under SECZ Innovation Hub Sandbox.'},
  {year:'2027+',title:'SADC Expansion',desc:'Pan-African expansion: Malawi, Zambia, Botswana. Target 80+ listed assets, 8,000 investors by Year 3.'},
];

const PARTNERS=[
  {name:'SECZ',full:'Securities & Exchange Commission of Zimbabwe',role:'Primary Regulator',icon:'🏛️'},
  {name:'IFC',full:'International Finance Corporation',role:'Technical Assistance Partner',icon:'🌍'},
  {name:'AfDB',full:'African Development Bank',role:'Equity Partner (Prospective)',icon:'🏦'},
  {name:'Polygon',full:'Polygon PoS Network',role:'Blockchain Infrastructure',icon:'⛓️'},
  {name:'Stanbic Bank',full:'Stanbic Bank Zimbabwe',role:'Banking & Distribution',icon:'🏢'},
  {name:'Ecobank',full:'Ecobank Zimbabwe',role:'Banking & Distribution',icon:'🏢'},
];

export default function AboutPage() {
  const router=useRouter();

  return(
    <div className="min-h-screen bg-gray-950 text-white pt-20">

      {/* HERO */}
      <section className="relative py-24 px-6 overflow-hidden border-b border-gray-800">
        <div className="absolute inset-0 opacity-5" style={{backgroundImage:`linear-gradient(${NAVY} 1px,transparent 1px),linear-gradient(90deg,${NAVY} 1px,transparent 1px)`,backgroundSize:'60px 60px'}}/>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <span className="inline-block text-xs uppercase tracking-[0.3em] text-gray-500 mb-6 border border-gray-800 px-4 py-2 rounded-full">About TokenEquityX</span>
          <h1 className="text-5xl md:text-6xl font-black leading-tight mb-6">
            Built for <span style={{color:GOLD}}>Africa's</span><br/>Capital Markets
          </h1>
          <p className="text-gray-400 text-xl leading-relaxed max-w-3xl mx-auto">
            TokenEquityX is Zimbabwe's first blockchain-based digital capital markets platform — bringing institutional-grade tokenisation infrastructure to African issuers and investors.
          </p>
        </div>
      </section>

      {/* WHO WE ARE */}
      <section id="who-we-are" className="py-20 px-6 border-b border-gray-800">
        <div className="max-w-screen-xl mx-auto grid grid-cols-1 xl:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-4 block">Who We Are</span>
            <h2 className="text-4xl font-black mb-6">Africa's Digital Capital Market Infrastructure</h2>
            <div className="space-y-4 text-gray-400 leading-relaxed">
              <p>TokenEquityX Ltd is a Harare-based fintech company building institutional-grade digital capital markets infrastructure for Africa. We enable the tokenisation of real-world assets — real estate, mining, bonds, infrastructure, and equity — on the Polygon blockchain, with settlement in USDC.</p>
              <p>We exist because Africa has a USD 42 billion annual SME financing gap, and yet billions of dollars in productive assets — farms, mines, commercial properties, infrastructure concessions — remain illiquid and inaccessible to investors. We are changing that.</p>
              <p>Our platform connects asset owners who need capital with investors who need yield — through a regulated, transparent, blockchain-secured marketplace that operates under the oversight of the Securities and Exchange Commission of Zimbabwe.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              {value:'$42B',label:'African SME financing gap per year'},
              {value:'4',label:'Asset classes currently tokenised'},
              {value:'342',label:'Registered investors and growing'},
              {value:'100%',label:'USDC-denominated settlement'},
            ].map((s,i)=>(
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
                <p className="text-4xl font-black mb-2" style={{color:i%2===0?GOLD:'#16a34a'}}>{s.value}</p>
                <p className="text-gray-500 text-sm leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MISSION */}
      <section id="mission" className="py-20 px-6 border-b border-gray-800" style={{background:`linear-gradient(to bottom,transparent,#0d111a,transparent)`}}>
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-4 block">Our Mission</span>
          <h2 className="text-4xl font-black mb-8">To democratise access to capital across Africa</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {[
              {icon:'🌍',title:'Financial Inclusion',desc:'Make institutional-quality investment opportunities accessible to accredited retail investors across Zimbabwe and the SADC region — not just the ultra-wealthy.'},
              {icon:'🔓',title:'Asset Liquidity',desc:'Unlock the value of productive but illiquid assets. A farm, a mine, a commercial building — any asset can become tradeable on a regulated exchange.'},
              {icon:'🏛️',title:'Regulatory Integrity',desc:'Operate under the full oversight of SECZ. Every listing, every trade, every investor — KYC-verified, compliance-checked, and regulated.'},
            ].map((v,i)=>(
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <span className="text-3xl mb-4 block">{v.icon}</span>
                <h3 className="font-bold text-lg mb-3">{v.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TEAM */}
      <section id="team" className="py-20 px-6 border-b border-gray-800">
        <div className="max-w-screen-xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-4 block">Leadership</span>
            <h2 className="text-4xl font-black">The Team</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {TEAM.map((m,i)=>(
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white" style={{background:m.color}}>{m.initials}</div>
                  <div><p className="font-black text-xl">{m.name}</p><p className="text-sm" style={{color:GOLD}}>{m.role}</p></div>
                </div>
                <p className="text-gray-400 leading-relaxed">{m.bio}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-4xl mx-auto">
            <h3 className="font-bold text-lg mb-4">Advisory Board</h3>
            <p className="text-gray-400 mb-4">TokenEquityX is building a 7-seat advisory board comprising experts in African capital markets, digital finance, mining, real estate, and regulatory law. Advisory appointments are in progress alongside our SECZ sandbox engagement.</p>
            <p className="text-gray-500 text-sm">Interested in joining our Advisory Board? <button onClick={()=>router.push('/contact')} className="underline text-blue-400 hover:text-blue-300">Contact us</button></p>
          </div>
        </div>
      </section>

      {/* REGULATORY */}
      <section id="regulatory" className="py-20 px-6 border-b border-gray-800">
        <div className="max-w-screen-xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-4 block">Regulation</span>
            <h2 className="text-4xl font-black">Regulatory Status</h2>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3"><span className="text-2xl">🏛️</span><h3 className="font-bold text-lg">SECZ Innovation Hub Sandbox</h3></div>
                <p className="text-gray-400 text-sm leading-relaxed mb-3">TokenEquityX has applied for designation under the Securities and Exchange Commission of Zimbabwe's Innovation Hub Regulatory Sandbox. The sandbox allows fintech companies to operate under a supervised regulatory environment while full licensing frameworks are developed.</p>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/><span className="text-green-400 text-sm font-semibold">Application Active — Under Review</span></div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="font-bold mb-3">Applicable Legal Framework</h3>
                <div className="space-y-2 text-sm text-gray-400">
                  {['Securities and Exchange Act (Chapter 24:25)','Collective Investment Schemes Act','Companies and Other Business Entities Act','Financial Intelligence Unit — KYC/AML requirements','Reserve Bank of Zimbabwe — USDC/fintech guidelines'].map((l,i)=><div key={i} className="flex items-center gap-2"><span className="text-gray-600">›</span><span>{l}</span></div>)}
                </div>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="font-bold mb-4">Compliance Commitments</h3>
              <div className="space-y-3">
                {[
                  {title:'100% KYC Verification',desc:'Every investor and issuer is KYC-verified by a qualified compliance officer before any transaction.'},
                  {title:'Smart Contract Audit',desc:'All 11 platform contracts independently audited by Certik or Hacken prior to mainnet deployment.'},
                  {title:'Legal Token Opinion',desc:'Formal legal opinion on token classification under Zimbabwe securities law obtained before any public offering.'},
                  {title:'Quarterly Reporting',desc:'Full financial and compliance reporting to SECZ each quarter during sandbox operations.'},
                  {title:'FIU Reporting',desc:'All suspicious transaction reports filed with Zimbabwe\'s Financial Intelligence Unit as required.'},
                ].map((c,i)=>(
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <div><p className="font-medium text-sm">{c.title}</p><p className="text-gray-500 text-xs mt-0.5">{c.desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MILESTONES */}
      <section className="py-20 px-6 border-b border-gray-800">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-4 block">Journey</span>
            <h2 className="text-4xl font-black">Our Milestones</h2>
          </div>
          <div className="relative">
            <div className="absolute left-16 top-0 bottom-0 w-px bg-gray-800"/>
            <div className="space-y-8">
              {MILESTONES.map((m,i)=>(
                <div key={i} className="flex items-start gap-6">
                  <div className="w-32 text-right flex-shrink-0">
                    <span className="text-xs font-bold" style={{color:GOLD}}>{m.year}</span>
                  </div>
                  <div className="relative">
                    <div className="w-3 h-3 rounded-full bg-gray-800 border-2 absolute -left-9 top-1.5" style={{borderColor:GOLD}}/>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                      <p className="font-bold mb-1">{m.title}</p>
                      <p className="text-gray-400 text-sm leading-relaxed">{m.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PARTNERSHIPS */}
      <section id="partnerships" className="py-20 px-6">
        <div className="max-w-screen-xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-4 block">Ecosystem</span>
            <h2 className="text-4xl font-black">Partners & Stakeholders</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {PARTNERS.map((p,i)=>(
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-start gap-4">
                <span className="text-3xl">{p.icon}</span>
                <div>
                  <p className="font-bold">{p.name}</p>
                  <p className="text-gray-500 text-xs mb-1">{p.full}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300">{p.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 border-t border-gray-800 text-center">
        <h3 className="text-2xl font-black mb-4">Ready to be part of Africa's digital capital market?</h3>
        <div className="flex items-center justify-center gap-4">
          <button onClick={()=>router.push('/#login-section')} className="px-8 py-3 rounded-xl font-bold text-gray-900 hover:opacity-90" style={{background:GOLD}}>Start Investing</button>
          <button onClick={()=>router.push('/contact')} className="px-8 py-3 rounded-xl font-bold border border-gray-700 text-white hover:border-gray-500">Contact Us</button>
        </div>
      </section>
    </div>
  );
}
