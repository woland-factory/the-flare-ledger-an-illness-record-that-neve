import { expect, test } from "@playwright/test";
import { authenticate } from "./helpers";

test.describe("mobile home", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("one primary action, tappable and without horizontal scroll", async ({ page }) => {
    await authenticate(page);
    await page.goto("/home");

    const primary = page.locator(".btn-primary");
    await expect(primary).toHaveCount(1);
    await expect(primary).toHaveText("Start a flare");

    const box = await primary.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(overflow).toBe(true);
  });

  test("starting a flare asks for onset and persists the choice", async ({ page }) => {
    await authenticate(page);
    await page.goto("/home");

    await page.getByRole("button", { name: "Start a flare" }).click();

    const sheet = page.getByRole("dialog", { name: "When did it start?" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Today" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "A few days ago" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Around a date" })).toBeVisible();

    await sheet.getByRole("button", { name: "A few days ago" }).click();

    // A brand-new user finishes the guided first run at its success state,
    // then lands on the normal home with the open flare.
    await expect(page.getByText("That is your first flare")).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();

    await expect(page.getByText("Flare in progress")).toBeVisible();
    await expect(page.getByText(/^Started around /)).toBeVisible();

    await page.reload();
    await expect(page.getByText("Flare in progress")).toBeVisible();
    await expect(page.getByText(/^Started around /)).toBeVisible();
  });
});

test("empty ledger shows a designed, positive empty state", async ({ page }) => {
  await authenticate(page);
  await page.goto("/ledger");

  await expect(page.getByRole("heading", { name: "Your flares will live here" })).toBeVisible();
  await expect(page.getByText("Start one the moment it begins. It takes a tap.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start a flare" })).toBeVisible();

  const body = (await page.locator("body").innerText()).toLowerCase();
  for (const banned of ["you don't have", "no flares yet", "nothing here", "something went wrong"]) {
    expect(body).not.toContain(banned);
  }
});
