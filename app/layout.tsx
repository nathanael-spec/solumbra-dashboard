import type { Metadata, Viewport } from 'next';
import '../styles/brand.css';
import '../styles/dash.css';

export const metadata: Metadata = {
  title: `${process.env.BUSINESS_NAME?.trim() || 'Solumbra'} dashboard`,
  description: 'The business at a glance. Meetings, proposals, deals, cash.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#07090B', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
