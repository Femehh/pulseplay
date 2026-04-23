import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/app/components/ui/Toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'PulsePlay — Competitive Minigames',
  description: 'Real-time multiplayer minigames. React faster, think sharper, climb the ranks.',
  keywords: ['multiplayer', 'minigames', 'competitive', 'reaction time', 'online games'],
  openGraph: {
    title: 'PulsePlay',
    description: 'Real-time multiplayer minigames',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${mono.variable} font-sans bg-background text-text antialiased`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
