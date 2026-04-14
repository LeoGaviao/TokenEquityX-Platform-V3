'use client';
import { useRouter } from 'next/navigation';

const NAVY='#1A3C5E', GOLD='#C8972B', GREEN='#16a34a';

export default function TechnologyPage() {
  const router=useRouter();
  return(
    <div className="min-h-screen bg-gray-950 text-white pt-20">
      <section className="py-24 px-6 border-b border-gray-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{backgroundImage:`linear-gradient(${NAVY} 1px,transparent 1px),linear-gradient(90deg,${NAVY} 1px,transparent 1px)`,backgroundSize:'60px 60px'}}/>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <span className="inline-block text-xs uppercase tracking-[0.3em] text-gray-500 mb-6 border border-gray-800 px-4 py-2 rounded-full">Technology</span>
          <h1 className="text-5xl md:text-6xl font-black mb-6">Built on <span style={{color:GOLD}}>Blockchain</span>.<br/>Designed for Africa.</h1>
          <p className="text-gray-400 text-xl">Institutional-grade infrastructure on Polygon. 11 audited smart contracts. USDC settlement. Real-time matching engine. Built from first principles for African capital markets.</p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20 px-6 border-b border-gray-800">
        <div className="max-w-screen-xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">How It Works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              {n:'01',icon:'🏢',title:'Asset Registration',desc:'Issuer registers SPV, completes KYC, uploads prospectus and financials. Compliance team reviews and approves.'},
              {n:'02',icon:'🔍',title:'Auditor Valuation',desc:'Independent ICAZ auditor reviews financial data and certifies the oracle price using a documented valuation model.'},
              {n:'03',icon:'⛓️',title:'Token Deployment',desc:'AssetToken smart contract deployed on Polygon. Token supply minted. Oracle price set. Trading enabled.'},
              {n:'04',icon:'💵',title:'Invest & Earn',desc:'KYC-verified investors place buy/sell orders. Orders match and settle in USDC. Distributions sent directly to wallets.'},
            ].map((s,i)=>(
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 relative">
                <div className="text-5xl font-black opacity-10 absolute top-4 right-4" style={{color:GOLD}}>{s.n}</div>
                <span className="text-3xl mb-4 block">{s.icon}</span>
                <h3 className="font-bold mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SMART CONTRACTS */}
      <section id="contracts" className="py-20 px-6 border-b border-gray-800" style={{background:'linear-gradient(to bottom,transparent,#0d111a,transparent)'}}>
        <div className="max-w-screen-xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">Smart Contract Architecture</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">11 purpose-built contracts on Polygon PoS. Solidity 0.8.22. OpenZeppelin v5. UUPS upgradeable. 42 unit tests passing.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[
              {name:'AssetToken',type:'ERC-20 Token',desc:'UUPS upgradeable ERC-20 with transfer restrictions, KYC gating, and compliance hooks. One contract per listed asset.',icon:'🪙'},
              {name:'AssetFactory',type:'Factory',desc:'Deploys new AssetToken contracts. Maintains registry of all listed tokens. Admin-controlled with governance override.',icon:'🏭'},
              {name:'ExchangeSettlement',type:'Core Exchange',desc:'Order book matching engine. Supports market and limit orders. Atomic settlement — both sides or neither.',icon:'⚖️'},
              {name:'ComplianceManager',type:'Access Control',desc:'Central KYC registry. Checks compliance before every transfer. Integrates with all token contracts.',icon:'🛡️'},
              {name:'PriceOracle',type:'Oracle',desc:'Auditor-controlled price feed. TWAP calculation. Variance monitoring. Emits events on every price update.',icon:'📊'},
              {name:'DividendDistributor',type:'Finance',desc:'Pull-based distribution. Snapshot of eligible holders. Funds held in escrow — investors claim at will.',icon:'💰'},
              {name:'GovernanceModule',type:'Governance',desc:'Token-weighted voting on issuer proposals. Supports For/Against/Abstain. Time-locked results.',icon:'🗳️'},
              {name:'MarketController',type:'Risk',desc:'Circuit breakers. Market state management (Pre-Launch → Full Trading). Daily volume limits. Emergency halt.',icon:'🔒'},
              {name:'DebtManager',type:'Bonds',desc:'Bond coupon scheduling and payment tracking. Maturity management. Integrated with DividendDistributor.',icon:'📜'},
              {name:'P2PTransferModule',type:'Transfer',desc:'Peer-to-peer token transfers with compliance checks. Whitelisted transfer pairs.',icon:'🔄'},
              {name:'MockUSDC',type:'Testnet',desc:'ERC-20 USDC mock for testnet operations. Faucet-enabled for sandbox testing.',icon:'🧪'},
            ].map((c,i)=>(
              <div key={i} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl">{c.icon}</span>
                  <div><p className="font-bold">{c.name}</p><span className="text-xs text-blue-300 bg-blue-900/50 px-2 py-0.5 rounded-full">{c.type}</span></div>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section id="security" className="py-20 px-6 border-b border-gray-800">
        <div className="max-w-screen-xl mx-auto grid grid-cols-1 xl:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-4 block">Security</span>
            <h2 className="text-4xl font-black mb-6">Security First</h2>
            <div className="space-y-4">
              {[
                {icon:'🔎',title:'Smart Contract Audit',desc:'Full audit of all 11 contracts by Certik or Hacken before mainnet deployment. USD 60,000 investment in security.'},
                {icon:'🔐',title:'Wallet-Based Authentication',desc:'No passwords. MetaMask signature-based login. JWT tokens. No centrally stored credentials to breach.'},
                {icon:'🌐',title:'Polygon Security Model',desc:'Polygon PoS consensus with 100+ validators. Immutable transaction history. No single point of failure.'},
                {icon:'🔄',title:'Annual Penetration Testing',desc:'Annual external penetration test of web application, API, and infrastructure by certified security firm.'},
                {icon:'📋',title:'Access Control',desc:'Role-based access. Every admin action is logged on-chain. No single operator can move funds unilaterally.'},
              ].map((s,i)=>(
                <div key={i} className="flex items-start gap-3">
                  <span className="text-xl">{s.icon}</span>
                  <div><p className="font-semibold text-sm">{s.title}</p><p className="text-gray-400 text-xs mt-0.5">{s.desc}</p></div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="font-bold mb-4">Network Specifications</h3>
              <div className="space-y-2">
                {[['Blockchain','Polygon PoS'],['Chain ID','137 (Mainnet) / 80002 (Amoy Testnet)'],['Solidity Version','0.8.22'],['Framework','Hardhat 2.x'],['Token Standard','ERC-20 (Modified)'],['Upgrade Pattern','UUPS (OpenZeppelin v5)'],['Settlement Currency','USDC — USD Coin'],['Avg Block Time','2.1 seconds'],['Avg Gas Cost','USD 0.001 per tx'],['Audit Firm','Certik / Hacken (pre-mainnet)']].map(([k,v],i)=>(
                  <div key={i} className="flex justify-between text-sm border-b border-gray-800/50 pb-1.5 last:border-0">
                    <span className="text-gray-400">{k}</span><span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* API */}
      <section id="api" className="py-20 px-6 border-b border-gray-800">
        <div className="max-w-screen-xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">API Access</h2>
            <p className="text-gray-400">Programmatic access to TokenEquityX market data for DeFi protocols and institutional partners.</p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="space-y-3">
              {[
                {m:'GET',p:'/api/ticker',d:'All listed assets — prices, volumes, yields',auth:false},
                {m:'GET',p:'/api/assets/all',d:'Full asset catalogue with market data',auth:false},
                {m:'GET',p:'/api/trading/candles/:symbol',d:'OHLCV candlestick data',auth:true},
                {m:'GET',p:'/api/trading/orderbook/:symbol',d:'Current order book depth',auth:true},
                {m:'POST',p:'/api/trading/order',d:'Place a buy or sell order',auth:true},
                {m:'WS',p:'ws://localhost:3001',d:'Real-time price and trade events',auth:true},
              ].map((e,i)=>(
                <div key={i} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${e.m==='GET'?'bg-green-900/60 text-green-300':e.m==='POST'?'bg-blue-900/60 text-blue-300':'bg-purple-900/60 text-purple-300'}`}>{e.m}</span>
                  <code className="text-yellow-400 text-xs font-mono flex-1">{e.p}</code>
                  <span className="text-gray-500 text-xs">{e.d}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${e.auth?'bg-amber-900/50 text-amber-300':'bg-gray-700 text-gray-400'}`}>{e.auth?'Auth':'Public'}</span>
                </div>
              ))}
            </div>
            <div>
              <pre className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-xs text-green-400 font-mono overflow-x-auto">{`// Get live ticker
const res = await fetch(
  'https://api.tokenequityx.com/api/ticker'
);
const assets = await res.json();
// [{ symbol:'ZWIB', price:'1.0240', yield:8.5 }, ...]

// WebSocket real-time feed
const ws = new WebSocket(
  'wss://api.tokenequityx.com'
);
ws.onmessage = ({ data }) => {
  const { type, symbol, price } = JSON.parse(data);
  if (type === 'PRICE_UPDATE') {
    console.log(symbol, price);
  }
};`}</pre>
              <button onClick={()=>router.push('/contact#partner')} className="w-full mt-4 py-3 rounded-xl font-bold text-white hover:opacity-90" style={{background:NAVY}}>Request API Access</button>
            </div>
          </div>
        </div>
      </section>

      {/* WHITE-LABEL */}
      <section id="whitelabel" className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-black mb-6">White-Label Platform</h2>
          <p className="text-gray-400 leading-relaxed mb-8 max-w-2xl mx-auto">Deploy a fully branded digital capital markets platform for your bank, exchange, or financial institution. Powered by TokenEquityX infrastructure — your brand, your clients, your revenue.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[
              {icon:'🏷️',title:'Full Branding',desc:'Custom domain, logo, colour scheme, and email communications. Completely white-labelled — no TokenEquityX branding.'},
              {icon:'🔌',title:'API Integration',desc:'Connect to your existing core banking, CRM, and KYC systems via our integration API.'},
              {icon:'🏦',title:'Regulatory Support',desc:'We guide you through the regulatory application process in your jurisdiction.'},
            ].map((f,i)=>(
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <span className="text-3xl mb-3 block">{f.icon}</span>
                <h3 className="font-bold mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
          <button onClick={()=>router.push('/contact#partner')} className="px-8 py-3 rounded-xl font-bold text-gray-900 hover:opacity-90" style={{background:GOLD}}>Enquire About White-Label</button>
        </div>
      </section>
    </div>
  );
}
