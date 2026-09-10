import { expect, test } from "@playwright/test";
import { DEMO_EMAIL, DEMO_PASSWORD, randomIp } from "./helpers";

test("SEED_DEMO shows real content for the demo user", async ({ page }) => {
  const res = await page.request.post("/api/auth/signin", {
    data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    headers: { "x-forwarded-for": randomIp() },
  });
  expect(res.status()).toBe(200);

  await page.goto("/home");
  await expect(page.getByText("Flare in progress")).toBeVisible();

  await page.goto("/ledger");
  await expect(page.getByRole("heading", { name: "Your ledger" })).toBeVisible();
  // At least two past (closed) flares from the seed.
  expect(await page.locator(".pill-closed").count()).toBeGreaterThanOrEqual(2);
});
