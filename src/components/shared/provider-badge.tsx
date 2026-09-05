"use client";

import { useEffect, useState } from "react";
import { Cpu, ShieldCheck, ChevronDown, CheckCircle2, Server } from "lucide-react";

interface ProviderStatusData {
  mode: "live" | "demo";
  displayLabel: string;
  ai: {
    provider: string;
    model: string;
    isLive: boolean;
    status: string;
  };
  speech: {
    provider: string;
    isLive: boolean;
    status: string;
  };
  ocr: {
    provider: string;
    isLive: boolean;
    status: string;
  };
  database: {
    type: string;
    isDemoMode: boolean;
    status: string;
  };
}

export function ProviderBadge() {
  const [status, setStatus] = useState<ProviderStatusData | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetch("/api/status/providers")
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch(() => {
        // Fallback default
        setStatus({
          mode: "demo",
          displayLabel: "Demo Mode",
          ai: { provider: "deterministic-rules", model: "deterministic", isLive: false, status: "ready" },
          speech: { provider: "deterministic-demo", isLive: false, status: "ready" },
          ocr: { provider: "deterministic-demo", isLive: false, status: "ready" },
          database: { type: "mock-adapter", isDemoMode: true, status: "ready" },
        });
      });
  }, []);

  if (!status) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-surface-100 px-2.5 py-1.5 rounded-full border border-surface-200">
        <span className="h-2 w-2 rounded-full bg-slate-300 animate-ping" />
        <span>Initializing...</span>
      </div>
    );
  }

  const isLive = status.mode === "live";

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-tight transition-all border shadow-2xs ${
          isLive
            ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
            : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
        }`}
        title="Click to view intelligence provider status"
      >
        <span
          className={`h-2 w-2 rounded-full ${
            isLive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
          }`}
        />
        <span>{status.displayLabel}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-surface-200 bg-white p-4 shadow-xl z-50 text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-surface-100 pb-2">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Cpu className="h-4 w-4 text-clinical-600" />
                <span>Intelligence Providers</span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  isLive ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {status.mode}
              </span>
            </div>

            <div className="space-y-2.5 text-slate-600">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-800">AI Clinical Copilot</p>
                  <p className="text-[11px] text-slate-500">{status.ai.provider}</p>
                </div>
                <span className="flex items-center gap-1 font-mono text-[11px] text-clinical-700 bg-clinical-50 px-2 py-0.5 rounded border border-clinical-200">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  {status.ai.model}
                </span>
              </div>

              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-800">Speech / ASR</p>
                  <p className="text-[11px] text-slate-500">{status.speech.provider}</p>
                </div>
                <span className="font-mono text-[11px] text-slate-600 bg-surface-100 px-2 py-0.5 rounded border border-surface-200">
                  {status.speech.isLive ? "Multimodal Live" : "Synthetic ASR"}
                </span>
              </div>

              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-800">Document OCR</p>
                  <p className="text-[11px] text-slate-500">{status.ocr.provider}</p>
                </div>
                <span className="font-mono text-[11px] text-slate-600 bg-surface-100 px-2 py-0.5 rounded border border-surface-200">
                  {status.ocr.isLive ? "Vision Live" : "Offline OCR"}
                </span>
              </div>

              <div className="flex items-start justify-between border-t border-surface-100 pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Database Layer</p>
                  <p className="text-[11px] text-slate-500">{status.database.type}</p>
                </div>
                <span className="font-mono text-[11px] text-slate-600 bg-surface-100 px-2 py-0.5 rounded border border-surface-200">
                  {status.database.isDemoMode ? "Mock / Demo" : "Supabase Live"}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-500 border border-surface-200 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-clinical-600 shrink-0 mt-0.5" />
              <span>
                Deterministic fallback engine active. Zero latency spikes during live demonstration.
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
