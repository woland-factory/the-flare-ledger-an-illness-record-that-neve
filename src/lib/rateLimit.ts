// In-process fixed-window rate limiter. Sufficient for the single staging
// instance this EPIC targets. A shared store (e.g. Redis) is a later concern
// once the app runs on more than one instance; do not add it here.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const authLimit = () => ({
  max: intEnv("RATE_LIMIT_AUTH_MAX", 10),
  windowMs: intEnv("RATE_LIMIT_AUTH_WINDOW_MS", 60_000),
});

export const mutationLimit = () => ({
  max: intEnv("RATE_LIMIT_MUTATION_MAX", 60),
  windowMs: intEnv("RATE_LIMIT_MUTATION_WINDOW_MS", 60_000),
});

// Downloading the whole record is heavier than a normal read, so it carries its
// own generous per-user limit. Safe default, env-tunable, degrades like the rest.
export const exportLimit = () => ({
  max: intEnv("RATE_LIMIT_EXPORT_MAX", 30),
  windowMs: intEnv("RATE_LIMIT_EXPORT_WINDOW_MS", 3_600_000),
});

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
  now: number = Date.now(),
): { ok: boolean } {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (bucket.count >= max) return { ok: false };
  bucket.count += 1;
  return { ok: true };
}

/** Test helper: clear all buckets so limits do not bleed between cases. */
export function resetRateLimits(): void {
  buckets.clear();
}
