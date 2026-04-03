import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import { SiteChrome } from "@/components/SiteChrome";
import { EOSLT_PATHNAME_HEADER } from "@/lib/eoslt-request-headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EOSLT",
  description: "Next.js 16 + Auth.js + Convex",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = (await headers()).get(EOSLT_PATHNAME_HEADER) ?? "";
  const obsOverlay = pathname.startsWith("/overlay");

  return (
    <html lang="en" {...(obsOverlay ? { "data-eoslt-obs-overlay": "1" } : {})}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
