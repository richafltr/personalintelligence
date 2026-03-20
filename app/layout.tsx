import { Toaster } from 'sonner';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import Link from 'next/link';
import type { Metadata } from 'next';

import { Sidebar } from '@/components/sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reasoning Preview',
  description:
    'This is a preview of using reasoning models with Next.js and the AI SDK.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
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
