import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Providers } from './providers';
import './globals.css';

const interVariable = localFont({
  src: [
    { path: './fonts/InterVariable.woff2', style: 'normal', weight: '100 900' },
    { path: './fonts/InterVariable-Italic.woff2', style: 'italic', weight: '100 900' },
  ],
  variable: '--font-inter-variable',
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'SalesOS | Retail POS',
  description: 'SalesOS Retail POS for fast, offline-capable store checkout, inventory, sales, and customer management.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'SalesOS POS', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#0b0d0c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={interVariable.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('salesos-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',t==='dark'?'#0b0d0c':'#f6f8f5')}}catch(e){}` }} />
      </head>
      <body className={interVariable.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
