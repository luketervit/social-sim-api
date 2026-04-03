import type { Metadata } from "next";
import localFont from "next/font/local";
import { Azeret_Mono, Fraunces } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import NavAuth from "./nav-auth";

const brandFont = localFont({
  variable: "--font-body",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
  src: [
    {
      path: "./fonts/PPNeueMontreal-Thin.otf",
      weight: "200",
      style: "normal",
    },
    {
      path: "./fonts/PPNeueMontreal-Book.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/PPNeueMontreal-Medium.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/PPNeueMontreal-Bold.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/PPNeueMontreal-Italic.otf",
      weight: "400",
      style: "italic",
    },
  ],
});

const displayFont = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const tacticalFont = Azeret_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Atharias",
  description: "Understand your audience before you ship. Multi-agent discourse simulations powered by psychographic personas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${brandFont.className} ${brandFont.variable} ${displayFont.variable} ${tacticalFont.variable}`}>
        <header className="header">
          <nav className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
            <Link href="/" className="logo">
              Atharias
            </Link>
            <div className="flex items-center gap-1">
              <Link href="/" className="nav-link">Home</Link>
              <Link href="/#playground" className="nav-link">Playground</Link>
              <Link href="/explore" className="nav-link">Explore</Link>
              <Link href="/docs" className="nav-link">Docs</Link>
              <NavAuth />
            </div>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
