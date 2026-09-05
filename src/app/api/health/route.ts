import { NextResponse } from "next/server";
import { env } from "@/config/env";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    app: env.appName,
    version: env.appVersion,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.isDemoMode ? "demo" : "production",
  });
}
