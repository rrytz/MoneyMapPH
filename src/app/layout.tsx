import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, Martian_Mono } from "next/font/google";
import Script from "next/script";
import { SerwistProvider } from "@serwist/turbopack/react";
import { ThemeProvider } from "@/providers/theme-provider";
import "./globals.css";

// S5a type split — three roles, mirroring the language split:
// characterful where identity speaks, plain where function speaks,
// mono strictly where a real measurement is shown.
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
});

const martianMono = Martian_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "MoneyMap PH",
  description: "Personal finance management for Filipinos",
  applicationName: "MoneyMapPH",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MoneyMapPH",
  },
  icons: {
    icon: [
      { url: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f1f4f0",
  // Required for env(safe-area-inset-*) to resolve to real values in standalone
  // (without viewport-fit=cover the insets are all 0 and content runs under the
  // notch/Dynamic Island and home indicator).
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Legacy iOS PWA tag — modern Safari uses mobile-web-app-capable (emitted by Next), older iOS reads this one. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('moneymap-theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${instrumentSans.variable} ${bricolage.variable} ${martianMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          <SerwistProvider
            swUrl="/serwist/sw.js"
            disable={process.env.NODE_ENV === "development"}
          >
            {children}
          </SerwistProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

