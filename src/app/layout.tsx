import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import TopNav from "@/components/TopNav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Newport Specialty Partners | MGA Platform",
  description:
    "Centralized CRM and portfolio management platform for tracking, acquiring, and managing Managing General Agents.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans text-slate-900 antialiased">
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef2ff,_#f4f6fb_55%)]">
          <TopNav />
          <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
