import { expect, test } from "@playwright/test";
import { authenticate } from "./helpers";

test.describe("guided first run", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("walks a brand-new user to their first flare and never returns", async ({ page }) => {
    await authenticate(page); // a brand-new user, no flares
    await page.goto("/home");

    // The guide shows its two imperative steps anchored to the real controls.
    await expect(page.getByText("Start a flare.", { exact: true })).toBeVisible();
    await expect(page.getByText("Say when it began.", { exact: true })).toBeVisible();
    const startBtn = page.getByRole("button", { name: "Start a flare" });
    await expect(startBtn).toBeVisible();
    // Skippable at every step.
    await expect(page.getByRole("button", { name: "Skip" })).toBeVisible();

    // No horizontal scroll at 390px.
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(noOverflow).toBe(true);

    // Step through the real flow: start, then the onset sheet, to a first success.
    await startBtn.click();
    const sheet = page.getByRole("dialog", { name: "When did it start?" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Today" }).click();

    await expect(page.getByText("That is your first flare")).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();

    // A flare now exists: the guide is gone and stays gone across a reload.
    await expect(page.getByText("Start a flare.", { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("Start a flare.", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Start a flare" })).toBeVisible();
  });

  test("a returning user with flares never sees the guide", async ({ page }) => {
    await authenticate(page);
    // A flare already exists, so this is a returning user.
    await page.request.post("/api/flares");
    await page.goto("/home");
    await expect(page.getByText("Start a flare.", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Say when it began.", { exact: true })).toHaveCount(0);
  });

  test("skip dismisses the guide without logging a flare", async ({ page }) => {
    await authenticate(page);
    await page.goto("/home");
    await expect(page.getByText("Say when it began.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByText("Say when it began.", { exact: true })).toHaveCount(0);

    // The primary action stays live and no flare was created by skipping.
    await expect(page.getByRole("button", { name: "Start a flare" })).toBeVisible();
    const list = await page.request.get("/api/flares");
    expect((await list.json()).flares).toHaveLength(0);
  });
});
