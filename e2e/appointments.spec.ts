import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { signup } from "./helpers";

function iso(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function closedFlare(
  ctx: APIRequestContext,
  onsetDaysAgo: number,
  endDaysAgo: number,
  treatments: Array<Record<string, unknown>> = [],
): Promise<string> {
  const created = await ctx.post("/api/flares");
  expect(created.status()).toBe(201);
  const id = (await created.json()).flare.id as string;
  const onset = await ctx.patch(`/api/flares/${id}`, {
    data: { onset_choice: "around_date", around_date: iso(onsetDaysAgo) },
  });
  expect(onset.status()).toBe(200);
  const closed = await ctx.post(`/api/flares/${id}/close`, {
    data: {
      end_choice: "around_date",
      end_around_date: iso(endDaysAgo),
      treatments,
    },
  });
  expect(closed.status()).toBe(200);
  return id;
}

test("create drafts since the previous appointment, all-time on the first", async ({ playwright }) => {
  const ctx = await playwright.request.newContext();
  await signup(ctx);

  const endedBefore = await closedFlare(ctx, 60, 50);
  const endedAfter = await closedFlare(ctx, 40, 20, [
    { name: "Naproxen", start_choice: "flare_onset", helped: "yes" },
  ]);
  const openRes = await ctx.post("/api/flares");
  const openId = (await openRes.json()).flare.id as string;

  // First visit: all recorded flares, no range.
  const first = await ctx.post("/api/appointments", {
    data: { visit_date: iso(30), specialty: "Rheumatology" },
  });
  expect(first.status()).toBe(201);
  const firstAppt = (await first.json()).appointment;
  expect(firstAppt.snapshot.rangeStart).toBeNull();
  expect(firstAppt.snapshot.truncated).toBe(false);
  expect(firstAppt.snapshot.flares.map((f: { key: string }) => f.key)).toEqual([
    endedBefore,
    endedAfter,
    openId,
  ]);
  const drafted = firstAppt.snapshot.flares[1];
  expect(drafted.source).toBe("drafted");
  expect(drafted.treatments[0].name).toBe("Naproxen");

  // Second visit: only flares open or ended on/after the first visit date.
  const second = await ctx.post("/api/appointments", { data: { visit_date: iso(0) } });
  expect(second.status()).toBe(201);
  const secondAppt = (await second.json()).appointment;
  expect(secondAppt.snapshot.rangeStart).toBe(iso(30));
  expect(secondAppt.snapshot.flares.map((f: { key: string }) => f.key)).toEqual([
    endedAfter,
    openId,
  ]);

  await ctx.dispose();
});

test("drafts are scoped to the caller and the list stays lean", async ({ playwright }) => {
  const a = await playwright.request.newContext();
  const b = await playwright.request.newContext();
  await signup(a);
  await signup(b);

  const foreignFlare = await closedFlare(b, 20, 10);
  await closedFlare(a, 15, 12);

  const created = await a.post("/api/appointments", { data: { visit_date: iso(0) } });
  const appt = (await created.json()).appointment;
  expect(appt.snapshot.flares).toHaveLength(1);
  expect(appt.snapshot.flares.map((f: { key: string }) => f.key)).not.toContain(
    foreignFlare,
  );

  await a.post("/api/appointments", {
    data: { visit_date: iso(200), specialty: "Neurology" },
  });
  const list = await a.get("/api/appointments");
  expect(list.status()).toBe(200);
  const items = (await list.json()).appointments;
  expect(items).toHaveLength(2);
  // Newest visit first; a count instead of the snapshot body.
  expect(items[0].visitDate).toBe(iso(0));
  expect(items[1].visitDate).toBe(iso(200));
  expect(items[1].specialty).toBe("Neurology");
  expect(items[0].flareCount).toBe(1);
  expect(items[0].snapshot).toBeUndefined();

  // Another user's appointment reads as not found, both ways.
  expect((await b.get(`/api/appointments/${appt.id}`)).status()).toBe(404);
  expect(
    (
      await b.patch(`/api/appointments/${appt.id}`, {
        data: { op: "set_visit", visit_date: iso(0) },
      })
    ).status(),
  ).toBe(404);

  await a.dispose();
  await b.dispose();
});

test("create rejects bad dates and unknown fields with 400", async ({ playwright }) => {
  const ctx = await playwright.request.newContext();
  await signup(ctx);
  const bad = [
    {},
    { visit_date: "not-a-date" },
    { visit_date: iso(400) },
    { visit_date: iso(-400) },
    { visit_date: iso(0), specialty: "x".repeat(81) },
    { visit_date: iso(0), admin: true },
  ];
  for (const data of bad) {
    const res = await ctx.post("/api/appointments", { data });
    expect(res.status(), JSON.stringify(data)).toBe(400);
  }
  await ctx.dispose();
});

test("every appointment route rejects an anonymous caller with 401", async ({ playwright }) => {
  const anon = await playwright.request.newContext();
  const id = "00000000-0000-0000-0000-000000000000";
  expect((await anon.get("/api/appointments")).status()).toBe(401);
  expect(
    (await anon.post("/api/appointments", { data: { visit_date: iso(0) } })).status(),
  ).toBe(401);
  expect((await anon.get(`/api/appointments/${id}`)).status()).toBe(401);
  expect(
    (
      await anon.patch(`/api/appointments/${id}`, {
        data: { op: "set_visit", visit_date: iso(0) },
      })
    ).status(),
  ).toBe(401);
  await anon.dispose();
});

test("corrections persist, survive a visit-date change, and validate", async ({ playwright }) => {
  const ctx = await playwright.request.newContext();
  await signup(ctx);
  const flareId = await closedFlare(ctx, 25, 20);
  const created = await ctx.post("/api/appointments", { data: { visit_date: iso(0) } });
  const apptId = (await created.json()).appointment.id as string;

  // A correction lands in the stored snapshot and survives a re-GET.
  const noted = await ctx.patch(`/api/appointments/${apptId}`, {
    data: { op: "set_flare", key: flareId, note: "Missed a week of work." },
  });
  expect(noted.status()).toBe(200);
  let reread = (await (await ctx.get(`/api/appointments/${apptId}`)).json()).appointment;
  expect(reread.snapshot.flares[0].note).toBe("Missed a week of work.");

  // Changing the visit does not redraft: the correction stays.
  const moved = await ctx.patch(`/api/appointments/${apptId}`, {
    data: { op: "set_visit", visit_date: iso(1), specialty: "Rheumatology" },
  });
  expect(moved.status()).toBe(200);
  reread = (await (await ctx.get(`/api/appointments/${apptId}`)).json()).appointment;
  expect(reread.visitDate).toBe(iso(1));
  expect(reread.specialty).toBe("Rheumatology");
  expect(reread.snapshot.flares[0].note).toBe("Missed a week of work.");

  // An added flare persists with its source and can be removed; a drafted
  // flare cannot.
  const added = await ctx.patch(`/api/appointments/${apptId}`, {
    data: { op: "add_flare", onset_date: iso(5), onset_precision: "approx" },
  });
  expect(added.status()).toBe(200);
  const addedFlare = (await added.json()).appointment.snapshot.flares.find(
    (f: { source: string }) => f.source === "added",
  );
  expect(addedFlare).toBeTruthy();
  expect(
    (
      await ctx.patch(`/api/appointments/${apptId}`, {
        data: { op: "remove_flare", key: flareId },
      })
    ).status(),
  ).toBe(400);
  const removed = await ctx.patch(`/api/appointments/${apptId}`, {
    data: { op: "remove_flare", key: addedFlare.key },
  });
  expect(removed.status()).toBe(200);
  expect((await removed.json()).appointment.snapshot.flares).toHaveLength(1);

  // Malformed and invalid ops answer 400.
  const bad = [
    { op: "improve_wording" },
    { op: "set_flare", key: flareId },
    { op: "set_flare", key: "not-a-key", peak_severity: 2 },
    { op: "set_flare", key: flareId, onset_date: iso(-5), onset_precision: "exact" },
    { op: "set_flare", key: flareId, end_date: iso(40), end_precision: "exact" },
  ];
  for (const data of bad) {
    const res = await ctx.patch(`/api/appointments/${apptId}`, { data });
    expect(res.status(), JSON.stringify(data)).toBe(400);
  }

  await ctx.dispose();
});

test("appointment mutations are rate limited per user (429)", async ({ playwright }) => {
  const ctx = await playwright.request.newContext();
  await signup(ctx);
  let status = 0;
  // The e2e mutation limit is 40 per window.
  for (let i = 0; i < 41; i++) {
    status = (
      await ctx.post("/api/appointments", { data: { visit_date: iso(0) } })
    ).status();
  }
  expect(status).toBe(429);
  await ctx.dispose();
});
