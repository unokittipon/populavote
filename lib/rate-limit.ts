// Simple in-memory rate limit. Single Vercel instance friendly.
// Resets when the server restarts (which is fine for school-scale).

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
} {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, retryAfterMs: 0 };
}

// Periodically clean up expired buckets so memory doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets.entries()) {
    if (now >= b.resetAt) buckets.delete(key);
  }
}, 60_000).unref?.();

// Get IP from request headers (Vercel sets x-forwarded-for)
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}