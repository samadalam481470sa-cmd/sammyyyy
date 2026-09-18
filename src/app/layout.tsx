import type { Metadata } from "next";

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
            <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
