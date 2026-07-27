import type {Metadata} from 'next';
import { Roboto } from 'next/font/google';
import './globals.css'; // Global styles
import AppShell from '@/components/layout/AppShell';

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-roboto',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FUSION ONE',
  description: 'FUSION ONE - Mobile Billing App',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={roboto.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                const originalFetch = window.fetch;
                try {
                  Object.defineProperty(window, 'fetch', {
                    configurable: true,
                    enumerable: true,
                    get: () => originalFetch,
                    set: (newFetch) => {
                      try {
                        Object.defineProperty(window, 'fetch', {
                          value: newFetch,
                          writable: true,
                          configurable: true,
                          enumerable: true
                        });
                      } catch (e) {}
                    }
                  });
                } catch (e) {}
              }
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
