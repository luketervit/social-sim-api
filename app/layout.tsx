import type { Metadata } from "next";
import localFont from "next/font/local";
import { Azeret_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import NavAuth from "./nav-auth";

const brandFont = localFont({
  variable: "--font-brand",
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

const tacticalFont = Azeret_Mono({
  variable: "--font-tactical",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Atharias",
  description: "Predict social backlash before launch. Multi-agent discourse simulations powered by psychographic personas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${brandFont.className} ${brandFont.variable} ${tacticalFont.variable}`}>
        <div className="noise-overlay" aria-hidden="true" />
        <header className="header">
          <nav className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-3">
            <Link href="/" className="logo">
              Atharias
            </Link>
            <div className="flex items-center gap-1">
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
