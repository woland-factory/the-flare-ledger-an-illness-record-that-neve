// Runs once when the server process starts, before it handles requests.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });
  }

  const { ensureSchema } = await import("./lib/dbInit");
  await ensureSchema();

  if (process.env.SEED_DEMO === "1") {
    const { prisma } = await import("./lib/db");
    const { seedDemo } = await import("./lib/seed");
    await seedDemo(prisma);
  }
}
