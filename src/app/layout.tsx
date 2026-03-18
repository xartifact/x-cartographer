import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AppLayout } from '@/components/layout';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'X-Product-Roadmap',
  description: 'AI Native 用户故事地图可视化应用',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
          className={inter.className}
          suppressHydrationWarning
          data-atm-ext-installed={typeof window !== 'undefined' ? '1.29.12' : undefined}
        >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppLayout showSidebar>
            {children}
          </AppLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
