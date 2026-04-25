import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

export const metadata: Metadata = {
  title: {
    default: "Reclaim Data — Reclaim the golden data hidden in your filing cabinet",
    template: "%s · Reclaim Data",
  },
  description:
    "Turn decades of paper contracts, scanned PDFs, Word docs, spreadsheets, and phone photos into a clean, validated customer database you can actually market to.",
  metadataBase: new URL(
    // `||` not `??` so an empty-string env var also falls back. Render's UI
    // can quietly set "" when the value is cleared — `new URL("")` throws.
    process.env.NEXT_PUBLIC_APP_URL || "https://reclaimdata.ai",
  ),
  openGraph: {
    title: "Reclaim Data",
    description:
      "Turn analog customer records into a clean, marketable database. A ReTHINK CNERGY product.",
    url: "https://reclaimdata.ai",
    siteName: "Reclaim Data",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
