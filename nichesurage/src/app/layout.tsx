import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { UserProvider } from "@/lib/context/UserContext";
import { AmbientBackground } from "@/components/layout/AmbientBackground";

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

export const metadata: Metadata = {
  title: "NicheSurge — Find YouTube Niches Before They Explode",
  description:
    "AI-powered YouTube niche discovery. Hourly scans of 230+ channels. Opportunity scores, viral spike detection, and Shorts + Longform discovery.",
  openGraph: {
    title: "NicheSurge — Find YouTube Niches Before They Explode",
    description: "AI-powered opportunity scanner. Real data, updated hourly.",
    siteName: "NicheSurge",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NicheSurge — Find YouTube Niches Before They Explode",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-carbon-950 text-slate-100`}
      >
        <AmbientBackground />
        <div className="relative z-10">
          <UserProvider>{children}</UserProvider>
        </div>
      </body>
    </html>
  );
}
