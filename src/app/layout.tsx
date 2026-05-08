import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BlockIndicator } from "@/app/_components/BlockIndicator";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PolyU Ardinals Mining Sim",
  description: "Teaching simulation: commit→reveal→verifiable randomness→rewards",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-950">
        <header className="border-b bg-white">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Link href="/" className="font-semibold tracking-tight">
                PolyU Mining Sim
              </Link>
              <BlockIndicator />
            </div>
            <nav className="flex items-center gap-4 text-sm text-zinc-700">
              <Link className="hover:text-zinc-950" href="/mine">
                Mine
              </Link>
              <Link className="hover:text-zinc-950" href="/wallet">
                Wallet
              </Link>
              <Link className="hover:text-zinc-950" href="/leaderboard">
                Leaderboard
              </Link>
              <Link className="hover:text-zinc-950" href="/verify">
                Verify
              </Link>
              <Link className="hover:text-zinc-950" href="/explorer">
                Explorer
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="border-t bg-white">
          <div className="mx-auto w-full max-w-5xl px-4 py-4 text-xs text-zinc-500">
            Commit→Reveal→drand randomness→reward. Classroom simulation only.
          </div>
        </footer>
      </body>
    </html>
  );
}
