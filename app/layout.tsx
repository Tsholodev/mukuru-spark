import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import { publicDemoConfig } from "@/lib/public-config";
import "./globals.css";

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
});

export const metadata: Metadata = {
  title: publicDemoConfig.appName,
  description: "Send money home with the fee, exchange rate, and payout clear before you confirm.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} antialiased`}>{children}</body>
    </html>
  );
}
