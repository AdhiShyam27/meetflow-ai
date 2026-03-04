/**
 * In-memory rate limiter for API routes.
 *
 * Uses a sliding-window counter keyed by arbitrary strings (user ID, IP, etc.).
 * For multi-instance deployments, swap the Map store for Redis/Upstash.
 *
 * Usage:
 *   const { allowed } = rateLimit(`summarize:${userId}`, 10, 60_000);
 *   if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 */

interface Entry {
  count: number;
  resetAt: number; // epoch ms when the window resets
}

const store = new Map<string, Entry>();

// Purge expired entries every 5 minutes to avoid unbounded memory growth
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

export function rateLimit(
  key: string,
  /** Maximum requests allowed within the window */
  limit: number,
  /** Window duration in milliseconds */
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // First request in this window
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}
