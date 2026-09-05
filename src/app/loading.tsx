export default function Loading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center" aria-live="polite">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-clinical-200 border-t-clinical-600" />
      <p className="mt-4 text-sm font-medium text-slate-600">Loading clinical workspace...</p>
    </div>
  );
}
