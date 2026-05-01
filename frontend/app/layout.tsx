import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tukole — Trusted deliveries for Kampala's online sellers",
  description:
    "Escrow-secured logistics for online businesses in Uganda. Customers pay safely. Riders get paid. Sellers see every shilling.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport = {
  themeColor: "#0E6B6B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
