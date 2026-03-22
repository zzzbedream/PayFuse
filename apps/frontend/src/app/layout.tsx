import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import DemoBanner from '@/components/demo-banner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PayFuse — Blockchain POS',
  description: 'Mobile POS powered by blockchain on Fuse Network',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}

