import { expect, test, type Page } from "@playwright/test";
import { authenticate } from "./helpers";

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Start an open flare whose onset is well in the past, so "a few days ago"
// (today minus three) is a valid end date.
async function openFlareWithPastOnset(page: Page): Promise<string> {
  const created = await page.request.post("/api/flares");
  const id = (await created.json()).flare.id;
  await page.request.patch(`/api/flares/${id}`, {
    data: { onset_choice: "around_date", around_date: daysAgoIso(20) },
  });
  return id;
}

test.describe("flare-end interview", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("walks the interview at 390px and closes with fuzzy, hedged answers", async ({ page }) => {
    await authenticate(page);
    await openFlareWithPastOnset(page);
    await page.goto("/home");

    await page.getByRole("button", { name: "This flare ended" }).click();

    const dialog = page.getByRole("dialog", { name: "When did it end?" });
    await expect(dialog).toBeVisible();
    // One question per step: a single step heading is shown.
    await expect(dialog.getByRole("heading", { level: 2 })).toHaveCount(1);

    // No horizontal scroll and comfortably tappable controls at 390px.
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(noOverflow).toBe(true);
    const endBtn = dialog.getByRole("button", { name: "A few days ago" });
    const box = await endBtn.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // Step 1: end in one tap.
    await endBtn.click();

    // Step 2: severity in one tap.
    await expect(page.getByRole("heading", { name: "How bad did it get?" })).toBeVisible();
    await page.getByRole("button", { name: "Peak severity 3 of 5" }).click();

    // Step 3: add a treatment that started "a few days in" (fuzzy, one tap).
    await expect(page.getByRole("heading", { name: "What did you try?" })).toBeVisible();
    await page.getByRole("button", { name: "Add a treatment" }).click();
    await page.getByLabel("Treatment").fill("Naproxen");
    await page.getByRole("button", { name: "A few days in" }).click();
    await page.getByRole("button", { name: "Helped", exact: true }).click();
    await page.getByRole("button", { name: "Save treatment" }).click();
    await expect(page.getByText("Naproxen")).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();

    // Step 4: notes optional, then close.
    await expect(page.getByRole("heading", { name: "Anything else to remember?" })).toBeVisible();
    await page.getByRole("button", { name: "Save and close" }).click();

    // Wait for the interview to finish closing before navigating away.
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // The ledger now reads the flare closed with hedged duration and end.
    await page.goto("/ledger");
    await expect(page.getByText(/Lasted about \d+ days/)).toBeVisible();
    await expect(page.getByText(/Ended around/)).toBeVisible();
    const ledgerNoOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(ledgerNoOverflow).toBe(true);
  });

  test("the skip-treatments branch closes with zero treatments", async ({ page }) => {
    await authenticate(page);
    const id = await openFlareWithPastOnset(page);
    await page.goto("/home");

    await page.getByRole("button", { name: "This flare ended" }).click();
    await page.getByRole("button", { name: "A few days ago" }).click();
    await page.getByRole("button", { name: "Not sure" }).click();

    await expect(page.getByRole("heading", { name: "What did you try?" })).toBeVisible();
    await page.getByRole("button", { name: "I didn't try anything" }).click();

    // The treatment sub-form is never shown on this branch.
    await expect(page.getByText("When did you start it?")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Anything else to remember?" })).toBeVisible();
    await page.getByRole("button", { name: "Save and close" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    const flare = await (await page.request.get(`/api/flares/${id}`)).json();
    expect(flare.flare.status).toBe("closed");
    expect(flare.flare.treatments).toHaveLength(0);
  });

  test("a failed submit holds the sheet and shows a product-voice error", async ({ page }) => {
    await authenticate(page);
    await openFlareWithPastOnset(page);
    await page.goto("/home");

    await page.route("**/api/flares/*/close", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );

    await page.getByRole("button", { name: "This flare ended" }).click();
    await page.getByRole("button", { name: "Today" }).click();
    await page.getByRole("button", { name: "Not sure" }).click();
    await page.getByRole("button", { name: "I didn't try anything" }).click();
    await page.getByRole("button", { name: "Save and close" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("alert")).toContainText("Check your connection and try again.");
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).not.toContain("stack");
  });
});

test.describe("flare edit surface", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("reopens a closed flare and edits its treatments, surviving reload", async ({ page }) => {
    await authenticate(page);
    const id = await openFlareWithPastOnset(page);
    // Close it through the API so we start on a closed flare.
    await page.request.post(`/api/flares/${id}/close`, {
      data: {
        end_choice: "today",
        peak_severity: 4,
        treatments: [{ name: "Rest", start_choice: "flare_onset", helped: "yes" }],
      },
    });

    await page.goto(`/flares/${id}/edit`);
    await expect(page.getByRole("heading", { name: "Edit flare" })).toBeVisible();
    await expect(page.getByText("Rest")).toBeVisible();

    // Reopen: the flare reads open again.
    await page.getByRole("button", { name: "Reopen this flare" }).click();
    await expect(page.getByText("Flare in progress")).toBeVisible();

    // Add a treatment through the editor.
    await page.getByRole("button", { name: "Add a treatment" }).click();
    await page.getByLabel("Treatment").fill("Ibuprofen");
    await page.getByRole("button", { name: "When the flare began" }).click();
    await page.getByRole("button", { name: "Didn't help" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Ibuprofen")).toBeVisible();

    // Edit that treatment's name.
    await page
      .locator(".treat-item", { hasText: "Ibuprofen" })
      .getByRole("button", { name: "Edit" })
      .click();
    await page.getByLabel("Treatment").fill("Ibuprofen 400");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Ibuprofen 400")).toBeVisible();

    // Reload: the changes persisted.
    await page.reload();
    await expect(page.getByText("Ibuprofen 400")).toBeVisible();
    await expect(page.getByText("Flare in progress")).toBeVisible();

    // Remove it.
    await page
      .locator(".treat-item", { hasText: "Ibuprofen 400" })
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(page.getByText("Ibuprofen 400")).toHaveCount(0);
  });
});
