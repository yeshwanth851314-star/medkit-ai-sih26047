import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/shared/header";
import { OfflineSyncIndicator } from "@/components/shared/offline-sync-indicator";

export const metadata: Metadata = {
  title: "MedKit AI — Intelligent Multimodal Clinical Intake & Physician Copilot",
  description: "Clinician-controlled multimodal clinical history capture, prior medical document digitization, and physician copilot. SIH26047.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col bg-surface-50 text-slate-900 antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-clinical-600 focus:px-4 focus:py-2 focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
        >
          Skip to main content
        </a>
        <OfflineSyncIndicator />
        <Header />
        <main id="main-content" className="flex-1" tabIndex={-1}>
          {children}
        </main>
        <footer className="border-t border-surface-200 bg-white py-4 text-center text-xs text-slate-500">
          <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              <strong>MedKit AI (SIH26047)</strong> — Clinical Intake & Documentation Assistant. Not an autonomous diagnostic system.
            </div>
            <div className="text-slate-600">
              Ministry of Ayush / AIIA • Provenance-stamped records
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
