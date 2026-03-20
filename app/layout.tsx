import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Atharias",
  description: "Simulations, simplified.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <header className="header">
          <nav className="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-3">
            <Link href="/" className="logo">
              Atharias
            </Link>
            <div className="flex items-center gap-1">
              <Link href="/keys" className="nav-link">API Keys</Link>
              <Link href="/docs" className="nav-link">Docs</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-[1080px] px-6">{children}</main>
      </body>
    </html>
  );
}
