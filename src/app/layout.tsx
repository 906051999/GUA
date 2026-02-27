import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@mantine/core/styles.css";
import "katex/dist/katex.min.css";
import "markstream-react/index.css";
import "./globals.css";
import { ColorSchemeScript } from "@mantine/core";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
const metadataBase = new URL(rawSiteUrl || "http://localhost:3000");
const siteTitle = "GUA · 不确定性归一化装置";
const siteDescription = "一句问题，推演你的个人宇宙常量。可复算、可追溯。";

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: siteTitle,
    template: "%s · GUA",
  },
  description: siteDescription,
  keywords: [
    "GUA",
    "不确定性归一化装置",
    "个人宇宙常量",
    "归一常量",
    "可复算",
    "可追溯",
    "离线推演",
    "本地模型",
  ],
  applicationName: "GUA",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  other: {
    "itemprop:name": siteTitle,
    "itemprop:description": siteDescription,
    "itemprop:image": "/opengraph-image",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/",
    siteName: "GUA",
    locale: "zh_CN",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: siteTitle,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/twitter-image"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/icon", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
    apple: [{ url: "/apple-icon", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0f17",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
