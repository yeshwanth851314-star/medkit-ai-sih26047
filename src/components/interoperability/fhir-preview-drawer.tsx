"use client";

import React, { useState } from "react";
import { FhirR4Bundle } from "../../features/interoperability/types";
import { ABDM_COMPLIANCE_DISCLAIMER } from "../../features/interoperability/fhir-mapper";

interface FhirPreviewDrawerProps {
  bundle: FhirR4Bundle;
  isOpen: boolean;
  onClose: () => void;
}

function getResourceDescriptor(res: Record<string, any>): string {
  if (res.code?.text) return String(res.code.text);
  if (Array.isArray(res.name) && res.name[0]?.text) return String(res.name[0].text);
  if (res.medicationCodeableConcept?.text) return String(res.medicationCodeableConcept.text);
  if (res.type?.text) return String(res.type.text);
  if (res.status) return `Status: ${res.status}`;
  return "Valid resource";
}

export function FhirPreviewDrawer({ bundle, isOpen, onClose }: FhirPreviewDrawerProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "json">("summary");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bundle.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Compute resource summary
  const resourceCounts = bundle.entry.reduce((acc, curr) => {
    const rType = curr.resource.resourceType || "Unknown";
    acc[rType] = (acc[rType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">FHIR R4 / ABDM Record Preview</h3>
            <p className="text-xs text-slate-500 font-mono">Bundle ID: {bundle.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {/* ABDM Compliance Banner */}
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-semibold text-emerald-900">
              {ABDM_COMPLIANCE_DISCLAIMER}
            </span>
          </div>
          <span className="text-[11px] font-medium text-emerald-700">HL7 FHIR R4 standard</span>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 px-6">
          <button
            type="button"
            onClick={() => setActiveTab("summary")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "summary"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Resource Summary ({bundle.entry.length} resources)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("json")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "json"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Raw JSON Document
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "summary" ? (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Included Clinical Resources
                </h4>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Object.entries(resourceCounts).map(([type, count]) => (
                    <div
                      key={type}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center"
                    >
                      <div className="text-xl font-bold text-slate-900">{count}</div>
                      <div className="text-xs font-medium text-slate-600">{type}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Resource Detail Log
                </h4>
                <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                  {bundle.entry.map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-blue-600">
                          {entry.resource.resourceType}
                        </span>
                        <span className="font-mono text-slate-400">({entry.resource.id})</span>
                      </div>
                      <span className="text-slate-500 truncate max-w-[200px]">
                        {getResourceDescriptor(entry.resource)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 font-mono text-xs text-emerald-400">
                {JSON.stringify(bundle, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={handleCopyJson}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {copied ? "✓ Copied JSON" : "Copy FHIR JSON"}
          </button>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Download FHIR Bundle (.json)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
