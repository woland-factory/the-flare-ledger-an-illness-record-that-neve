import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

// Kept in sync with src/lib/seed.ts. Staging demo credentials only.
export const DEMO_EMAIL = "demo@flareledger.app";
export const DEMO_PASSWORD = "flare-demo-2026";

let seq = 0;

export function uniqueEmail(): string {
  seq += 1;
  return `user-${Date.now()}-${seq}@example.com`;
}

// A fresh, random client IP so per-IP auth limits never bleed between tests
// (or between a test and its retry).
export function randomIp(): string {
  const oct = () => Math.floor(Math.random() * 254) + 1;
  return `${oct()}.${oct()}.${oct()}.${oct()}`;
}

export async function signup(
  request: APIRequestContext,
  email = uniqueEmail(),
  password = "test-password-123",
): Promise<{ email: string; password: string }> {
  const res = await request.post("/api/auth/signup", {
    data: { email, password },
    headers: { "x-forwarded-for": randomIp() },
  });
  expect(res.status()).toBe(201);
  return { email, password };
}

/** Sign a brand-new user into the browser context via the shared cookie jar. */
export async function authenticate(page: Page): Promise<void> {
  await signup(page.request);
}

/** Sign the seeded demo user into the page context. */
export async function signInDemo(page: Page): Promise<void> {
  const res = await page.request.post("/api/auth/signin", {
    data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    headers: { "x-forwarded-for": randomIp() },
  });
  expect(res.status()).toBe(200);
}
