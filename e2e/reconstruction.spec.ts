import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { authenticate, signInDemo } from "./helpers";

const SIGNATURE =
  "3 flares recorded. Longest about 12 days. Naproxen started on day one, that flare was about half as long.";

function iso(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function closedFlare(
  page: Page,
  onsetDaysAgo: number,
  endDaysAgo: number,
): Promise<string> {
  const created = await page.request.post("/api/flares");
  const id = (await created.json()).flare.id as string;
  await page.request.patch(`/api/flares/${id}`, {
    data: { onset_choice: "around_date", around_date: iso(onsetDaysAgo) },
  });
  await page.request.post(`/api/flares/${id}/close`, {
    data: { end_choice: "around_date", end_around_date: iso(endDaysAgo) },
  });
  return id;
}

async function createAppointment(page: Page): Promise<string> {
  const res = await page.request.post("/api/appointments", {
    data: { visit_date: iso(0) },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).appointment.id as string;
}

// The demo user's FIRST appointment carries the all-time signature draft.
// Create it once and reuse it on retries so the headline stays the §2 one.
async function demoAppointmentId(page: Page): Promise<string> {
  const list = await page.request.get("/api/appointments");
  const items = (await list.json()).appointments as Array<{ id: string }>;
  if (items.length > 0) return items[items.length - 1].id;
  const res = await page.request.post("/api/appointments", {
    data: { visit_date: iso(0), specialty: "Rheumatology" },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).appointment.id as string;
}

test.describe("at 390px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("home leads to the visits screen and a first draft", async ({ page }) => {
    await authenticate(page);
    await page.goto("/home");

    await page.getByRole("link", { name: "Doctor visit coming up?" }).click();
    await expect(page).toHaveURL(/\/appointments$/);

    // The empty state is designed and positive.
    await expect(
      page.getByText("One page for your doctor, drafted from your flares."),
    ).toBeVisible();

    // Slow the create down so the in-flight state is observable.
    await page.route("**/api/appointments", async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fallback();
    });
    await page.getByRole("button", { name: "Doctor visit coming up" }).click();
    await page.getByRole("button", { name: "Draft my timeline" }).click();
    await expect(page.getByRole("button", { name: "Drafting" })).toBeVisible();
    await page.unroute("**/api/appointments");

    await expect(page).toHaveURL(/\/appointments\/[0-9a-f-]+$/);
    await expect(
      page.getByRole("heading", { name: "Your draft timeline" }),
    ).toBeVisible();

    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(noOverflow).toBe(true);
  });

  test("the demo user reads the signature headline and honest coverage", async ({ page }) => {
    await signInDemo(page);
    const id = await demoAppointmentId(page);
    await page.goto(`/appointments/${id}`);

    await expect(page.getByText(SIGNATURE)).toBeVisible();
    await expect(
      page.getByText("Built from 3 recorded flares, not a daily diary."),
    ).toBeVisible();

    // Rows are comfortably tappable and nothing scrolls sideways.
    const row = page.locator(".snap-row").first();
    const box = await row.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(noOverflow).toBe(true);
  });

  test("a correction updates the row and headline live and persists", async ({ page }) => {
    await authenticate(page);
    await closedFlare(page, 40, 37); // about 4 days
    await closedFlare(page, 20, 15); // about 6 days
    const id = await createAppointment(page);
    await page.goto(`/appointments/${id}`);

    await expect(
      page.getByText("2 flares recorded. Longest about 6 days."),
    ).toBeVisible();

    // Extend the older flare's end: 40 days ago to 30 days ago is 11 days.
    await page.locator(".snap-row").first().click();
    await page.locator("#fs-end").fill(iso(30));
    await page.getByRole("button", { name: "Save", exact: true }).click();

    // The headline re-renders from the new snapshot without a reload.
    await expect(
      page.getByText("2 flares recorded. Longest about 11 days."),
    ).toBeVisible();
    await expect(page.locator(".snap-row").first()).toContainText("about 11 days");

    await page.reload();
    await expect(
      page.getByText("2 flares recorded. Longest about 11 days."),
    ).toBeVisible();
  });

  test("a missed flare can be added, persists, and can be removed", async ({ page }) => {
    await authenticate(page);
    await closedFlare(page, 20, 15);
    const id = await createAppointment(page);
    await page.goto(`/appointments/${id}`);

    await page.getByRole("button", { name: "Add a missed flare" }).click();
    await page.locator("#fs-onset").fill(iso(8));
    await page.getByRole("button", { name: "Save", exact: true }).click();

    const addedRow = page.locator(".snap-row", { hasText: "Added" });
    await expect(addedRow).toBeVisible();
    await expect(addedRow).toContainText("still going");

    await page.reload();
    await expect(page.locator(".snap-row", { hasText: "Added" })).toBeVisible();

    await page.locator(".snap-row", { hasText: "Added" }).click();
    await page.getByRole("button", { name: "Remove this flare" }).click();
    await expect(page.locator(".snap-row", { hasText: "Added" })).toHaveCount(0);
  });

  test("a failed save reports in the product voice with a retry path", async ({ page }) => {
    await authenticate(page);
    await closedFlare(page, 20, 15);
    const id = await createAppointment(page);
    await page.goto(`/appointments/${id}`);

    await page.route(`**/api/appointments/${id}`, (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
        : route.fallback(),
    );
    await page.locator(".snap-row").first().click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Check your connection and try again.")).toBeVisible();

    // The save stays available: retry succeeds once the network recovers.
    await page.unroute(`**/api/appointments/${id}`);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Check your connection and try again.")).toBeHidden();
  });
});

test("the one-pager prints clean on A4 and Letter with hedged wording", async ({ page }) => {
  await signInDemo(page);
  const id = await demoAppointmentId(page);
  await page.goto(`/appointments/${id}/print`);

  await expect(page.getByRole("heading", { name: "Flare timeline" })).toBeVisible();
  await expect(page.getByText(SIGNATURE)).toBeVisible();
  await expect(page.getByText(/Around .+ to around .+, about 12 days\./)).toBeVisible();
  await expect(
    page.getByText("Built from 3 recorded flares, not a daily diary."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to corrections" })).toBeVisible();

  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".topbar")).toBeHidden();
  await expect(page.getByRole("button", { name: "Print" })).toBeHidden();

  const breakInside = await page
    .locator(".onepage-flare")
    .first()
    .evaluate((el) => getComputedStyle(el).breakInside);
  expect(breakInside).toBe("avoid");

  // The demo record fits one page at both A4 (794px) and Letter (816px)
  // widths: content height stays under 950 CSS px.
  for (const width of [794, 816]) {
    await page.setViewportSize({ width, height: 1200 });
    const height = await page
      .locator(".onepage")
      .evaluate((el) => (el as HTMLElement).scrollHeight);
    expect(height, `width ${width}`).toBeLessThan(950);
  }
});

test("the reconstruction flow is signed-in only and never blank", async ({ page, playwright }) => {
  // Signed out, both screens redirect to sign-in.
  const anon = await playwright.request.newContext();
  const target = "00000000-0000-0000-0000-000000000000";
  for (const path of [`/appointments`, `/appointments/${target}`, `/appointments/${target}/print`]) {
    const res = await anon.get(path, { maxRedirects: 0 });
    expect([302, 303, 307], path).toContain(res.status());
    expect(res.headers()["location"], path).toContain("/signin");
  }
  await anon.dispose();

  // A record with no flares still drafts a real page: the quiet stretch and
  // a way back, never a blank sheet.
  await authenticate(page);
  const id = await createAppointment(page);
  await page.goto(`/appointments/${id}/print`);
  await expect(page.getByText("A quiet stretch so far.")).toBeVisible();
  await expect(
    page.getByText("Add a missed flare from the corrections page."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to corrections" })).toBeVisible();
});
