"use client";

import { useState, useEffect } from "react";
import { offlineQueue } from "@/features/offline/offline-queue";
import { WifiOff, RefreshCw, CheckCircle2, Cloud } from "lucide-react";

export function OfflineSyncIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedNotice, setSyncedNotice] = useState<string | null>(null);

  useEffect(() => {
    // Initial check
    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      setPendingCount(offlineQueue.getPendingItems().length);
    }

    const handleOnline = async () => {
      setIsOffline(false);
      const pending = offlineQueue.getPendingItems();
      if (pending.length > 0) {
        setIsSyncing(true);
        const { syncedCount } = await offlineQueue.processSync(async (item) => {
          try {
            if (item.entity === "cases") {
              const res = await fetch("/api/cases", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(item.payload),
              });
              return res.ok;
            }
            return true;
          } catch {
            return false;
          }
        });

        offlineQueue.clearSynced();
        setIsSyncing(false);
        setPendingCount(offlineQueue.getPendingItems().length);

        if (syncedCount > 0) {
          setSyncedNotice(`Synchronized ${syncedCount} queued record(s) to server.`);
          setTimeout(() => setSyncedNotice(null), 5000);
        }
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      setPendingCount(offlineQueue.getPendingItems().length);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline && !isSyncing && !syncedNotice && pendingCount === 0) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`border-b px-4 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
        isOffline
          ? "bg-amber-500 text-slate-950 border-amber-600"
          : isSyncing
          ? "bg-clinical-600 text-white border-clinical-700"
          : "bg-emerald-600 text-white border-emerald-700"
      }`}
    >
      <div className="mx-auto max-w-7xl w-full flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isOffline ? (
            <>
              <WifiOff className="h-4 w-4 shrink-0" />
              <span>
                Offline Mode Active — New case intakes are queued locally. {pendingCount > 0 ? `(${pendingCount} pending)` : ""}
              </span>
            </>
          ) : isSyncing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
              <span>Reconnected: Synchronizing queued records with clinical database...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{syncedNotice || "All offline records successfully synchronized."}</span>
            </>
          )}
        </div>

        <span className="text-[10px] opacity-90 hidden sm:inline font-mono">
          {isOffline ? "Rural Health Camp Safe" : "ABDM Cloud Sync"}
        </span>
      </div>
    </div>
  );
}
