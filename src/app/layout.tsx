import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import StructuredData from "@/app/components/StructuredData";
import GoogleAnalytics from "@/app/components/GoogleAnalytics";
import { generateMetadata, generateStructuredData } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// SEO最適化されたメタデータ
export const metadata: Metadata = generateMetadata({
  canonical: "/",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 構造化データ
  const websiteStructuredData = generateStructuredData("website");

  return (
    <html lang="ja">
      <head>
        <StructuredData data={websiteStructuredData} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gray-50`}
      >
        <GoogleAnalytics />
        <Header />
        <main id="main">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
