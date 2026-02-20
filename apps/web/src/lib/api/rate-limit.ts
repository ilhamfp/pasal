import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS } from "./cors";

interface WindowEntry {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowEntry>();

// Periodic cleanup to prevent unbounded growth
const MAX_ENTRIES = 10_000;
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of windows) {
    if (now > entry.resetAt) {
      windows.delete(key);
    }
  }
  // Hard cap: if still too large, drop oldest entries
  if (windows.size > MAX_ENTRIES) {
    const excess = windows.size - MAX_ENTRIES;
    const iter = windows.keys();
    for (let i = 0; i < excess; i++) {
      const key = iter.next().value;
      if (key) windows.delete(key);
    }
  }
}

/**
 * Check rate limit for a request. Returns null if allowed, or a 429 response if exceeded.
 */
export function checkRateLimit(
  request: NextRequest,
  route: string,
  maxRequests: number,
  windowSeconds: number = 60,
): NextResponse | null {
  cleanup();

  const ip =
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  const key = `${route}:${ip}`;
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || now > entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return null;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  return null;
}
