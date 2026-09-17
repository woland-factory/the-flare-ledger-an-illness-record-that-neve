import { expect, test } from "@playwright/test";
import { authenticate } from "./helpers";

// Dispatch a synthetic beforeinstallprompt: headless Chromium never fires it
// organically, so the test drives the install offer directly. The stub carries
// a no-op prompt() and the listener calls preventDefault().
const DISPATCH = `(() => {
  const e = new Event("beforeinstallprompt");
  e.prompt = async () => {};
  window.dispatchEvent(e);
})()`;

test.describe("PWA install and offline", () => {
  test("manifest is linked and valid with icons that resolve", async ({ page, request }) => {
    await authenticate(page);
    await page.goto("/home");

    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href).toBe("/manifest.webmanifest");

    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const manifest = JSON.parse(await res.text());
    expect(manifest.name).toBe("Flare Ledger");
    expect(manifest.start_url).toBe("/home");
    expect(manifest.display).toBe("standalone");

    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    for (const icon of manifest.icons) {
      const iconRes = await request.get(icon.src);
      expect(iconRes.status(), icon.src).toBe(200);
      expect(iconRes.headers()["content-type"], icon.src).toContain("image/png");
    }
  });

  test("the service worker registers and controls the page, and the shell loads offline", async ({
    page,
    context,
  }) => {
    await authenticate(page);
    await page.goto("/home");

    // The worker takes control (skipWaiting + clients.claim).
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
      timeout: 20_000,
    });

    // Offline: a navigation falls back to the cached offline shell, never a
    // browser error page.
    await context.setOffline(true);
    await page.goto("/ledger");
    await expect(page.getByRole("heading", { name: "Offline" })).toBeVisible();
    await expect(page.getByText("Your ledger is safe. Reconnect to open it.")).toBeVisible();
    await context.setOffline(false);
  });

  test("an install offer appears after first success and does not return once dismissed", async ({
    page,
  }) => {
    await authenticate(page);
    // A flare exists, so the home renders the install offer surface.
    await page.request.post("/api/flares");
    await page.goto("/home");
    await expect(page.getByRole("button", { name: "Start a flare" })).toBeVisible();

    const banner = page.getByText("Add Flare Ledger to your home screen.");
    // Re-dispatch until the listener is attached and the banner shows.
    await expect
      .poll(
        async () => {
          await page.evaluate(DISPATCH);
          return banner.isVisible();
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    await page.getByRole("button", { name: "Not now" }).click();
    await expect(banner).toBeHidden();

    // After dismissal it stays gone, even if the event fires again on reload.
    await page.reload();
    await page.evaluate(DISPATCH);
    await expect(banner).toBeHidden();
  });
});
