'use client';
import { usePathname } from 'next/navigation';
import Navigation   from './Navigation';
import Ticker       from './Ticker';
import PublicNav    from './PublicNav';
import PublicFooter from './PublicFooter';
import Equita       from './Equita';

export default function ClientShell({ children }) {
  const pathname   = usePathname();
  const isSetup    = pathname === '/setup';
  const isAuthPage = ['/admin', '/investor', '/issuer', '/auditor', '/partner', '/defi']
    .some(p => pathname.startsWith(p));

  return (
    <>
      {!isSetup && <Ticker />}
      {!isSetup && isAuthPage  && <Navigation />}
      {!isSetup && !isAuthPage && <PublicNav />}
      {children}
      {!isSetup && !isAuthPage && <PublicFooter />}
      {!isSetup && <Equita />}
    </>
  );
}
