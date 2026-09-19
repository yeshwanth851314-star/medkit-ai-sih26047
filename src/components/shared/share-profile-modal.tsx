"use client";

import React, { useState } from "react";
import {
  X,
  Share2,
  Copy,
  Check,
  ShieldCheck,
  QrCode as QrIcon,
  Printer,
  ExternalLink,
  UserCheck,
  Building2,
  Phone,
  Calendar,
} from "lucide-react";
import { QrCode } from "./qr-code";

export interface ProfileShareData {
  role: "patient" | "doctor" | "pharmacy" | "diagnostic";
  roleTitle: string;
  uniqueId: string;
  name: string;
  secondaryIdLabel?: string;
  secondaryIdValue?: string;
  facility: string;
  departmentOrScope: string;
  contactOrMeta?: string;
  validity?: string;
}

interface ShareProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileShareData;
}

export function ShareProfileModal({
  isOpen,
  onClose,
  profile,
}: ShareProfileModalProps) {
  const [hasCopied, setHasCopied] = useState(false);

  if (!isOpen) return null;

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/profile?id=${encodeURIComponent(
          profile.uniqueId
        )}&role=${profile.role}`
      : `https://medkit-ai-sih26047.vercel.app/verify/profile?id=${profile.uniqueId}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 3000);
      }
    } catch {
      // Fallback
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const roleTheme = {
    patient: {
      badgeBg: "bg-amber-100",
      badgeText: "text-amber-900",
      accentBorder: "border-amber-400",
      headerBg: "bg-gradient-to-r from-amber-500 to-amber-600",
      iconBg: "bg-amber-100 text-amber-800",
    },
    doctor: {
      badgeBg: "bg-clinical-100",
      badgeText: "text-clinical-900",
      accentBorder: "border-clinical-400",
      headerBg: "bg-gradient-to-r from-clinical-600 to-clinical-700",
      iconBg: "bg-clinical-100 text-clinical-700",
    },
    pharmacy: {
      badgeBg: "bg-emerald-100",
      badgeText: "text-emerald-900",
      accentBorder: "border-emerald-400",
      headerBg: "bg-gradient-to-r from-emerald-600 to-emerald-700",
      iconBg: "bg-emerald-100 text-emerald-700",
    },
    diagnostic: {
      badgeBg: "bg-purple-100",
      badgeText: "text-purple-900",
      accentBorder: "border-purple-400",
      headerBg: "bg-gradient-to-r from-purple-600 to-purple-700",
      iconBg: "bg-purple-100 text-purple-700",
    },
  }[profile.role];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-profile-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn"
    >
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-surface-200 space-y-6 relative overflow-hidden animate-scaleUp">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-surface-200 pb-3">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-clinical-600" />
            <h2 id="share-profile-title" className="text-base font-bold text-slate-900">
              Verified Healthcare Identity Card &amp; QR
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Printable / Visual Credential ID Card */}
        <div
          className={`rounded-2xl border-2 ${roleTheme.accentBorder} bg-white shadow-md overflow-hidden`}
        >
          {/* Top Banner */}
          <div className={`${roleTheme.headerBg} px-5 py-3 text-white flex items-center justify-between`}>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/90">
                Government of India • Ministry of Ayush / AIIA
              </div>
              <div className="text-sm font-extrabold">{profile.roleTitle}</div>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold backdrop-blur-xs">
              <ShieldCheck className="h-3 w-3" />
              <span>Verified ID</span>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-5 flex flex-col sm:flex-row items-center gap-5">
            {/* Left: Scannable QR Code */}
            <div className="flex flex-col items-center shrink-0">
              <QrCode
                value={shareUrl}
                size={130}
                title={`QR for ${profile.name} (${profile.uniqueId})`}
              />
              <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                Scan to Verify
              </span>
            </div>

            {/* Right: Identity Details */}
            <div className="space-y-2 text-left w-full">
              <div>
                <span
                  className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${roleTheme.badgeBg} ${roleTheme.badgeText}`}
                >
                  {profile.role.toUpperCase()}
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 leading-tight mt-0.5">
                  {profile.name}
                </h3>
              </div>

              <div className="space-y-1 text-xs text-slate-700">
                <div className="flex items-center justify-between border-b border-surface-100 pb-1">
                  <span className="text-slate-500 font-medium">Unique ID:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {profile.uniqueId}
                  </span>
                </div>

                {profile.secondaryIdLabel && profile.secondaryIdValue && (
                  <div className="flex items-center justify-between border-b border-surface-100 pb-1">
                    <span className="text-slate-500 font-medium">
                      {profile.secondaryIdLabel}:
                    </span>
                    <span className="font-mono font-semibold text-slate-800">
                      {profile.secondaryIdValue}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between border-b border-surface-100 pb-1">
                  <span className="text-slate-500 font-medium">Facility:</span>
                  <span className="font-semibold text-slate-800 line-clamp-1">
                    {profile.facility}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Department:</span>
                  <span className="font-semibold text-slate-800">
                    {profile.departmentOrScope}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Shareable Link Input & Actions */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700">
            Shareable Verification Link:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="w-full rounded-xl border border-surface-300 bg-surface-50 px-3 py-2 text-xs font-mono text-slate-700 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl bg-clinical-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-clinical-700 transition-colors"
            >
              {hasCopied ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2 border-t border-surface-200">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-xl border border-surface-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-surface-50 transition-colors"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Print ID Card</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
