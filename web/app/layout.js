'use client';
import { Geist } from "next/font/google";
import "./globals.css";
import Navigation from "../components/ui/Navigation";
import Ticker from "../components/ui/Ticker";
import PublicNav from "../components/ui/PublicNav";
import PublicFooter from "../components/ui/PublicFooter";
import Equita from "../components/ui/Equita";
import { usePathname } from "next/navigation";

const geist = Geist({ subsets: ["latin"] });

export default function RootLayout({ children }) {
  const pathname = usePathname();
  const isSetup  = pathname === '/setup';

  // Pages that use the authenticated nav (not the public nav)
  const isAuthPage = ['/admin','/investor','/issuer','/auditor','/partner','/defi']
    .some(p => pathname.startsWith(p));

  return (
    <html lang="en">
      <body className={`${geist.className} bg-gray-950 min-h-screen text-white`}>
        {/* Authenticated pages: show ticker + auth nav */}
        {!isSetup && <Ticker />}
        {!isSetup && isAuthPage && <Navigation />}

        {/* Public nav — home page only */}
        {!isSetup && !isAuthPage && <PublicNav />}

        {children}

        {/* Footer on public pages only */}
        {!isSetup && !isAuthPage && <PublicFooter />}

        {/* Equita AI assistant on all pages except setup */}
        {!isSetup && <Equita />}
      </body>
    </html>
  );
}
 
