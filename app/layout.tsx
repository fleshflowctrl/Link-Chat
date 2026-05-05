import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
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

export const metadata: Metadata = {
  title: "whisper — echte mensen, echte gesprekken",
  description: "Een rustige plek om in je eigen tempo te chatten.",
};

/** Lock mobile viewport so users can't pinch / double-tap zoom (native-app feel). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
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
      </body>
    </html>
  );
}
