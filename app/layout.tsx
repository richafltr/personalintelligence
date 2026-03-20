import { Toaster } from 'sonner';
import { Chakra_Petch, Lora } from 'next/font/google';
import type { Metadata } from 'next';

import { Sidebar } from '@/components/sidebar';
import './globals.css';

const chakraPetch = Chakra_Petch({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-heading',
});

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: "Richa's Personal Intelligence",
  description:
    'A personal AI reasoning engine for deep thinking, research, and multimodal understanding.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${chakraPetch.variable} ${lora.variable}`}>
      <body>
        <div className="flex flex-row h-dvh w-full overflow-hidden dark:bg-zinc-950 bg-white">
          <Sidebar />
          <main className="flex-1 overflow-y-auto relative bg-white dark:bg-zinc-950">
            <Toaster position="top-center" />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
