import { expect, test } from "@playwright/test";
import { authenticate, signInDemo } from "./helpers";

test.describe("ledger rows at 390px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("each row is scannable and hedges duration honestly", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/ledger");

    await expect(page.getByRole("heading", { name: "Your ledger" })).toBeVisible();

    // The demo record carries an approx-bounded long flare and an exact short
    // flare, so both hedging paths render.
    await expect(page.getByText("Lasted about 12 days")).toBeVisible();
    await expect(page.getByText("Lasted 6 days")).toBeVisible();

    // Severity and key treatments are readable without opening a flare.
    await expect(page.getByText("Peak severity 4 of 5")).toBeVisible();
    await expect(page.getByText("Peak severity 3 of 5")).toBeVisible();
    await expect(page.getByText("Severity not recorded")).toBeVisible();
    await expect(page.getByText("Rest, Naproxen")).toBeVisible();

    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(noOverflow).toBe(true);
  });

  test("tapping a row opens its editable detail", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/ledger");
    await page.locator(".flare-row").first().click();
    await expect(page).toHaveURL(/\/flares\/[0-9a-f-]+\/edit$/);
    await expect(page.getByRole("heading", { name: "Edit flare" })).toBeVisible();
  });
});

test("first page renders server-side", async ({ page }) => {
  await authenticate(page);
  await page.request.post("/api/flares");
  await page.request.post("/api/flares");

  const res = await page.request.get("/ledger");
  const html = await res.text();
  // Real rows are in the first HTML response, not only after a client fetch.
  expect(html).toContain("flare-row");
  expect(html).toContain("Your ledger");
});

test("load older appends the next page and then disappears", async ({ page }) => {
  await authenticate(page);
  // More than one page (page size is 25).
  for (let i = 0; i < 26; i++) {
    const res = await page.request.post("/api/flares");
    expect(res.status()).toBe(201);
  }

  await page.goto("/ledger");
  await expect(page.locator(".flare-row")).toHaveCount(25);

  const older = page.getByRole("button", { name: "Load older flares" });
  await expect(older).toBeVisible();
  await older.click();

  await expect(page.locator(".flare-row")).toHaveCount(26);
  await expect(older).toBeHidden();
});
