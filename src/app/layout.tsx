import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/shared/header";

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
        <Header />
        <main className="flex-1">
          {children}
        </main>
        <footer className="border-t border-surface-200 bg-white py-4 text-center text-xs text-slate-500">
          <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              <strong>MedKit AI (SIH26047)</strong> — Clinical Intake & Documentation Assistant. Not an autonomous diagnostic system.
            </div>
            <div className="text-slate-400">
              Ministry of Ayush / AIIA • Provenance-stamped records
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
