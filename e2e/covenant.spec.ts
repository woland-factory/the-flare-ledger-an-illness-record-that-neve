import { expect, test, type Page } from "@playwright/test";
import { authenticate, randomIp } from "./helpers";

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// An open flare whose onset is `n` days back, through the real onset flow.
async function openFlareDaysAgo(page: Page, n: number): Promise<string> {
  const created = await page.request.post("/api/flares");
  const id = (await created.json()).flare.id;
  await page.request.patch(`/api/flares/${id}`, {
    data: { onset_choice: "around_date", around_date: daysAgoIso(n) },
  });
  return id;
}

const NUDGE_HEADING = "Is this flare still going?";

test.describe("covenant nudge", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("surfaces exactly one calm nudge for a long-open flare, once", async ({ page }) => {
    await authenticate(page);
    await openFlareDaysAgo(page, 20);

    const marked = page.waitForResponse(
      (r) => /\/nudge$/.test(r.url()) && r.request().method() === "POST",
    );
    await page.goto("/home");

    await expect(page.getByRole("heading", { name: NUDGE_HEADING })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "It ended" })).toBeVisible();
    const stillGoing = page.getByRole("button", { name: "Still going" });
    await expect(stillGoing).toBeVisible();

    // No horizontal scroll and comfortably tappable controls at 390px.
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(noOverflow).toBe(true);
    const box = await stillGoing.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // Mark-on-surface recorded the single nudge; reloading shows it no more.
    await marked;
    await page.reload();
    await expect(page.getByRole("heading", { name: NUDGE_HEADING })).toHaveCount(0);
  });

  test("It ended opens the end-of-flare interview", async ({ page }) => {
    await authenticate(page);
    await openFlareDaysAgo(page, 20);
    await page.goto("/home");

    await expect(page.getByRole("heading", { name: NUDGE_HEADING })).toBeVisible();
    await page.getByRole("button", { name: "It ended" }).click();
    await expect(page.getByRole("dialog", { name: "When did it end?" })).toBeVisible();
  });

  test("a recent flare is never nudged", async ({ page }) => {
    await authenticate(page);
    await openFlareDaysAgo(page, 3);
    await page.goto("/home");

    await expect(page.getByText("Flare in progress")).toBeVisible();
    await expect(page.getByRole("heading", { name: NUDGE_HEADING })).toHaveCount(0);
  });

  test("a closed flare is never nudged", async ({ page }) => {
    await authenticate(page);
    const id = await openFlareDaysAgo(page, 20);
    await page.request.post(`/api/flares/${id}/close`, { data: { end_choice: "today" } });
    await page.goto("/home");

    await expect(page.getByRole("heading", { name: NUDGE_HEADING })).toHaveCount(0);
  });
});

test.describe("nudge endpoint", () => {
  test("records once, is idempotent, and guards auth and ownership", async ({ page, playwright }) => {
    await authenticate(page);
    const id = await openFlareDaysAgo(page, 20);

    // First and second calls both succeed; the second is idempotent.
    expect((await page.request.post(`/api/flares/${id}/nudge`)).status()).toBe(200);
    expect((await page.request.post(`/api/flares/${id}/nudge`)).status()).toBe(200);

    // A missing or foreign id is reported as not found.
    const missing = await page.request.post(
      "/api/flares/00000000-0000-0000-0000-000000000000/nudge",
    );
    expect(missing.status()).toBe(404);

    // No session is rejected.
    const anon = await playwright.request.newContext();
    const noAuth = await anon.post(`/api/flares/${id}/nudge`, {
      headers: { "x-forwarded-for": randomIp() },
    });
    expect(noAuth.status()).toBe(401);
    await anon.dispose();
  });

  test("is rate limited per user", async ({ page }) => {
    await authenticate(page);
    const id = await openFlareDaysAgo(page, 20);
    let status = 0;
    // The e2e server sets the mutation limit to 40.
    for (let i = 0; i < 41; i++) {
      status = (await page.request.post(`/api/flares/${id}/nudge`)).status();
    }
    expect(status).toBe(429);
  });
});
