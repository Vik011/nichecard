import type { Metadata } from "next";
import localFont from "next/font/local";
import { Instrument_Serif } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { UserProvider } from "@/lib/context/UserContext";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { PosthogProvider } from "@/components/providers/PosthogProvider";
import { CookieBanner } from "@/components/ui/CookieBanner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// Display serif for landing-page hero/section headings. Pairs with the
// Geist Sans body — sans + editorial serif gives the page an "authored
// by a human" character that matches the founder narrative tagline. The
// only weight Instrument Serif ships in is 400; that's the canonical
// usage. display: 'swap' avoids FOIT (per Quick Reference §3 font-loading).
const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://surgeniche.com"),
  title: {
    default: "SurgeNiche — Find YouTube Niches Before They Explode",
    template: "%s — SurgeNiche",
  },
  description:
    "AI-powered YouTube niche discovery. Hourly scans of 230+ channels. Opportunity scores, viral spike detection, and Shorts + Longform discovery.",
  openGraph: {
    title: "SurgeNiche — Find YouTube Niches Before They Explode",
    description: "AI-powered opportunity scanner. Real data, updated hourly.",
    siteName: "SurgeNiche",
    url: "https://surgeniche.com",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@surgeniche",
    title: "SurgeNiche — Find YouTube Niches Before They Explode",
    description: "AI-powered opportunity scanner. Real data, updated hourly.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased bg-canvas text-ink`}
      >
        <AmbientBackground />
        <Suspense fallback={null}>
          <PosthogProvider />
        </Suspense>
        <div className="relative z-10">
          <UserProvider>{children}</UserProvider>
          <CookieBanner />
        </div>
      </body>
    </html>
  );
}
