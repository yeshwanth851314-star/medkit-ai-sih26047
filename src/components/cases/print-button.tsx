"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.print();
      }}
      className="inline-flex items-center gap-2 rounded-lg bg-clinical-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-clinical-700"
    >
      <Printer className="h-4 w-4" /> Print / Save as PDF
    </button>
  );
}
