import { expect, test } from "@playwright/test";
import { authenticate, signInDemo, signup } from "./helpers";

test("JSON export is complete, parseable, and scoped to the caller", async ({ playwright }) => {
  const a = await playwright.request.newContext();
  const b = await playwright.request.newContext();
  await signup(a);
  await signup(b);

  const created = await a.post("/api/flares");
  const flareId = (await created.json()).flare.id;
  await a.post(`/api/flares/${flareId}/treatments`, {
    data: { name: "Naproxen", start_choice: "flare_onset", helped: "yes" },
  });

  // User B has a flare that must never appear in A's export.
  await b.post("/api/flares");

  const res = await a.get("/api/export?format=json");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/json");
  expect(res.headers()["content-disposition"]).toContain('attachment; filename="flare-ledger-');

  const doc = JSON.parse(await res.text());
  expect(doc.version).toBe(1);
  expect(doc.flares).toHaveLength(1);
  expect(doc.flares[0].id).toBe(flareId);
  expect(doc.flares[0].treatments[0].name).toBe("Naproxen");

  await a.dispose();
  await b.dispose();
});

test("CSV export returns a spreadsheet-safe file", async ({ request }) => {
  await signup(request);
  const created = await request.post("/api/flares");
  const flareId = (await created.json()).flare.id;
  await request.post(`/api/flares/${flareId}/treatments`, {
    data: { name: "Naproxen", start_choice: "flare_onset", helped: "yes" },
  });

  const res = await request.get("/api/export?format=csv");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  expect(res.headers()["content-disposition"]).toContain('attachment; filename="flare-ledger-');

  const body = await res.text();
  const lines = body.split("\r\n");
  expect(lines[0]).toBe(
    "onset_date,onset_precision,end_date,end_precision,duration_days,peak_severity,status,impact_note,symptom_note,treatment_name,treatment_started_on,treatment_started_precision,treatment_helped,treatment_note",
  );
  expect(lines[1]).toContain("Naproxen");
});

test("export rejects a bad format, an anonymous caller, and floods", async ({ request, playwright }) => {
  await signup(request);
  expect((await request.get("/api/export")).status()).toBe(400);
  expect((await request.get("/api/export?format=xml")).status()).toBe(400);

  const anon = await playwright.request.newContext();
  expect((await anon.get("/api/export?format=json")).status()).toBe(401);
  await anon.dispose();

  // The e2e export limit is 5 per window, so the sixth request is limited.
  let last = 0;
  for (let i = 0; i < 6; i++) {
    last = (await request.get("/api/export?format=csv")).status();
  }
  expect(last).toBe(429);
});

test("the print view shows the record, hides chrome, and avoids page splits", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/ledger/print");

  await expect(page.getByRole("heading", { name: "Your flare record" })).toBeVisible();
  await expect(page.getByText("Peak severity 4 of 5")).toBeVisible();
  await expect(page.getByText("Lasted about 12 days")).toBeVisible();

  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".topbar")).toBeHidden();
  await expect(page.getByRole("button", { name: "Print" })).toBeHidden();

  const breakInside = await page
    .locator(".print-flare")
    .first()
    .evaluate((el) => getComputedStyle(el).breakInside);
  expect(breakInside).toBe("avoid");
});

test("the print view is authorized and empty-state safe", async ({ page, playwright }) => {
  // Signed out is redirected to sign-in.
  const anon = await playwright.request.newContext();
  const res = await anon.get("/ledger/print", { maxRedirects: 0 });
  expect([302, 303, 307]).toContain(res.status());
  expect(res.headers()["location"]).toContain("/signin");
  await anon.dispose();

  // A brand-new user with no flares sees a positive line, never a blank page.
  await authenticate(page);
  await page.goto("/ledger/print");
  await expect(page.getByText("Start a flare to build your record.")).toBeVisible();
});

test("the export surface downloads and reports failures in the product voice", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/ledger");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download JSON" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("flare-ledger.json");

  // A forced failure shows a retryable, product-voice error, not a raw status.
  await page.route("**/api/export**", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );
  await page.getByRole("button", { name: "Download CSV" }).click();
  await expect(page.getByText("Check your connection and try again.")).toBeVisible();
});
