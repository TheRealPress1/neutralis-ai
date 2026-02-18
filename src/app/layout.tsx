import type { Metadata } from "next";
import { Geist, Geist_Mono, Italiana, Cormorant_Garamond } from "next/font/google";
import AuthListener from "./components/AuthListener";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const italiana = Italiana({
  variable: "--font-italiana",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Neutralis.ai — Automated prediction market arbitrage",
  description:
    "Neutralis detects arbitrage across prediction markets in real time, evaluates trades through quantitative risk guards, and executes automatically.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${italiana.variable} ${cormorantGaramond.variable} antialiased`}
      >
        <AuthListener />
        {children}
      </body>
    </html>
  );
}
