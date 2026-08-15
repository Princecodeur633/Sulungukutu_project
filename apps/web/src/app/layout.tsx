import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter, Sora, DM_Sans } from 'next/font/google';
import { Providers } from './providers';
import { RouteProgressBar } from '@/components/ui/RouteProgressBar';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: false,
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-cabinet',
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  preload: false,
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  preload: false,
});

export const viewport: Viewport = {
  themeColor: '#1e1b4b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sulungukutu',
  },
  title: {
    default: 'Sulungukutu — Gestion Scolaire',
    template: '%s | Sulungukutu',
  },
  description: 'Plateforme numérique de gestion scolaire — Inscriptions, Notes, Présences, Bulletins',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} ${sora.variable} ${dmSans.variable} font-sans antialiased`}>
        <RouteProgressBar />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

