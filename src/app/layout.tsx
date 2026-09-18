import type { Metadata } from "next";
import { Toaster } from "sonner";

import { AppNav } from "@/components/app-nav";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Newport Specialty Partners — MGA Platform",
    template: "%s · Newport Specialty Partners",
  },
  description:
    "CRM and portfolio management platform for Newport Specialty Partners' Managing General Agent roll-up: pipeline screening, aggregated portfolio and synergy analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased">
        <div className="flex min-h-screen flex-col lg:flex-row">
          <AppNav />
          <main className="min-w-0 flex-1">
            <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
              <div className="flex items-baseline gap-3">
                <span className="text-lg font-black tracking-[0.2em] text-navy-950">
                  NEWPORT
                </span>
                <span className="hidden text-[11px] font-medium uppercase tracking-wider text-slate-400 sm:inline">
                  Specialty Partners
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="hidden sm:inline">Mary Donovan</span>
                <span className="flex size-8 items-center justify-center rounded-full bg-navy-100 font-semibold text-navy-800">
                  MD
                </span>
              </div>
            </div>
            <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              {children}
            </div>
          </main>
        </div>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
