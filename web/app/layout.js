import { Geist } from 'next/font/google';
import './globals.css';
import ClientShell from '../components/ui/ClientShell';

const geist = Geist({ subsets: ['latin'] });

export const viewport = {
  themeColor: '#1A1F2E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata = {
  metadataBase: new URL('https://tokenequityx.co.zw'),
  title: {
    default:  'TokenEquityX',
    template: '%s | TokenEquityX',
  },
  description: "Africa's regulated blockchain capital markets platform — tokenize equity, real estate, mining rights and bonds on the SECZ Innovation Hub Sandbox.",
  keywords: ['tokenization', 'Zimbabwe', 'capital markets', 'blockchain', 'SECZ', 'digital assets', 'Africa', 'tokenised equity'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TokenEquityX',
  },
  openGraph: {
    type:        'website',
    locale:      'en_ZW',
    url:         'https://tokenequityx.co.zw',
    siteName:    'TokenEquityX',
    title:       "TokenEquityX — Africa's Digital Capital Market",
    description: "Africa's regulated blockchain capital markets platform — tokenize equity, real estate, mining rights and bonds.",
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'TokenEquityX' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'TokenEquityX',
    description: "Africa's regulated blockchain capital markets platform",
    images:      ['/og-image.png'],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.svg', sizes: '180x180', type: 'image/svg+xml' },
    ],
    other: [
      { rel: 'mask-icon', url: '/icons/icon-maskable-512x512.svg', color: '#C8972B' },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-gray-950 min-h-screen text-white`}>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
