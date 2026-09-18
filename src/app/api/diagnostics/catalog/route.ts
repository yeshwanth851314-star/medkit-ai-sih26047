import { NextResponse } from "next/server";
import { fetchDiagnosticCatalog } from "@/features/diagnostics/diagnostic-service";
import { extractBearerOrCookieToken } from "@/lib/auth/api-guard";

export async function GET(request: Request) {
  try {
    const token = extractBearerOrCookieToken(request);
    const catalog = await fetchDiagnosticCatalog(token);
    return NextResponse.json({ catalog });
  } catch (err: any) {
    console.error("GET /api/diagnostics/catalog error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch diagnostic catalog" },
      { status: 500 }
    );
  }
}
