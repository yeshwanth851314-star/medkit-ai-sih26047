"use client";

import { useState } from "react";
import { RedFlagAlertItem } from "@/features/red-flags/types";
import { AlertTriangle, ShieldAlert, CheckCircle2, UserCheck } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

import { ContextualHelp } from "@/components/help/contextual-help";

export function RedFlagBanner({
  alerts,
  caseId,
  onAcknowledged,
}: {
  alerts: RedFlagAlertItem[];
  caseId?: string;
  onAcknowledged?: (ruleId: string) => void;
}) {
  const [localAlerts, setLocalAlerts] = useState<RedFlagAlertItem[]>(alerts);
  const [isAcknowledging, setIsAcknowledging] = useState<string | null>(null);

  if (localAlerts.length === 0) return null;

  const handleAcknowledge = async (ruleId: string) => {
    setIsAcknowledging(ruleId);
    try {
      if (caseId) {
        await fetch(`/api/cases/${caseId}/red-flags`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ruleId }),
        });
      }

      setLocalAlerts((prev) =>
        prev.map((a) =>
          a.ruleId === ruleId
            ? {
                ...a,
                acknowledgedBy: "Attending Doctor",
                acknowledgedAt: new Date().toISOString(),
              }
            : a
        )
      );

      if (onAcknowledged) onAcknowledged(ruleId);
    } catch {
      console.error("Failed to record acknowledgement");
    } finally {
      setIsAcknowledging(null);
    }
  };

  return (
    <div className="space-y-3" role="alert" aria-live="assertive">
      {localAlerts.map((alert) => (
        <div
          key={alert.ruleId}
          className="rounded-2xl border-2 border-red-500 bg-red-50/90 p-5 shadow-sm text-red-950 transition-all"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white shrink-0 mt-0.5 shadow-sm" aria-hidden="true">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    CRITICAL CLINICAL RED FLAG
                  </span>
                  <span className="text-xs text-red-800 font-medium">
                    Rule Ref: <code>{alert.ruleId}</code>
                  </span>
                  <ContextualHelp topic="red_flags" />
                </div>
                <h3 className="mt-1 text-sm font-bold text-red-900 leading-snug">
                  {alert.message}
                </h3>
                <p className="mt-1 text-xs text-red-700 leading-relaxed italic">
                  Potential red flag detected — immediate clinical assessment recommended. Non-diagnostic alert.
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2 sm:self-center">
              {alert.acknowledgedAt ? (
                <div className="flex items-center gap-1.5 rounded-lg bg-white/80 border border-red-200 px-3.5 py-2 text-xs text-emerald-800 font-semibold min-h-[44px]">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Acknowledged ({formatDateTime(alert.acknowledgedAt)})</span>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isAcknowledging === alert.ruleId}
                  onClick={() => handleAcknowledge(alert.ruleId)}
                  className="inline-flex items-center justify-center min-h-[44px] min-w-[120px] rounded-lg bg-red-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 transition-colors disabled:opacity-50"
                  aria-label={`Acknowledge red flag ${alert.ruleId}: ${alert.message}`}
                >
                  {isAcknowledging === alert.ruleId ? "Recording..." : "Acknowledge Signal"}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
