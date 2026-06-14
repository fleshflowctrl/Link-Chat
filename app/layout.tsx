import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { MicrosoftClarity } from "@/components/analytics/microsoft-clarity";
import { NoZoom } from "@/components/system/no-zoom";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

import { SITE_TITLE } from "@/lib/brand";
import { SITE_META_DESCRIPTION } from "@/lib/site-positioning";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_META_DESCRIPTION,
};

/** Lock mobile viewport so users can't pinch / double-tap zoom (native-app feel). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  /** Keep the URL bar area stable; chat uses visualViewport for the keyboard. */
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body className={`${inter.variable} ${playfair.variable} font-sans`}>
        <NoZoom />
        {children}
        <MicrosoftClarity />
      </body>
    </html>
  );
}
