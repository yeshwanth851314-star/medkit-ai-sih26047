import { NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Prune expired entries periodically to prevent memory leaks
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

function cleanupStore(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTimeMs: number;
}

/**
 * In-memory sliding window rate limiter.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  cleanupStore();

  const now = Date.now();
  const { windowMs, maxRequests } = options;

  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime <= now) {
    entry = { count: 1, resetTime: now + windowMs };
    rateLimitStore.set(key, entry);
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTimeMs: entry.resetTime,
    };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTimeMs: entry.resetTime,
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetTimeMs: entry.resetTime,
  };
}

/**
 * Generates an HTTP 429 Too Many Requests response with standard headers.
 */
export function createRateLimitResponse(
  resetTimeMs: number,
  customMessage?: string
): NextResponse {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetTimeMs - Date.now()) / 1000));
  return NextResponse.json(
    {
      error: customMessage || "Too many requests. Please try again later.",
      retryAfter: retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}

/**
 * Extracts a dependable identifier from the request and optional authenticated user/token.
 */
export function getRateLimitKey(
  request: Request,
  prefix: string,
  actorId?: string
): string {
  if (actorId) {
    return `${prefix}:${actorId}`;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
  return `${prefix}:${ip}`;
}

/**
 * Resets the in-memory rate limit store (used for test isolation).
 */
export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}
