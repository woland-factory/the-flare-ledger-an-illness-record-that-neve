// Product analytics (Umami) renders only when both env values are present.
// Error tracking (Sentry) initializes in instrumentation.ts, also gated on
// env. With everything unset the app runs normally.
export function umamiConfig(): { url: string; websiteId: string } | null {
  const url = process.env.UMAMI_URL;
  const websiteId = process.env.UMAMI_WEBSITE_ID;
  if (!url || !websiteId) return null;
  return { url, websiteId };
}
