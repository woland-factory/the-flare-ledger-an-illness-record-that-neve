import { describe, expect, it, vi } from "vitest";

// Route handlers read the session through getCurrentUser. We drive it with a
// mutable acting user id instead of real cookies.
let actingUserId: string | null = null;
vi.mock("@/lib/auth", async (orig) => {
  const actual = await orig<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getCurrentUser: async () =>
      actingUserId
        ? { id: actingUserId, email: "t@example.com", conditionLabel: null }
        : null,
  };
});

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { addDays, toIsoDate, todayUtc } from "@/lib/date";
import { POST as closeFlare } from "@/app/api/flares/[id]/close/route";
import { GET as getFlare, PATCH as patchFlare } from "@/app/api/flares/[id]/route";
import { POST as addTreatment } from "@/app/api/flares/[id]/treatments/route";
import { PATCH as patchTreatment, DELETE as delTreatment } from "@/app/api/treatments/[id]/route";

function req(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

let userCounter = 0;
async function makeUser(): Promise<string> {
  userCounter += 1;
  const user = await prisma.user.create({
    data: { email: `u${userCounter}@example.com`, passwordHash: "x" },
  });
  return user.id;
}

async function makeOpenFlare(userId: string, onsetDaysAgo = 10): Promise<string> {
  const flare = await prisma.flare.create({
    data: {
      userId,
      status: "open",
      onsetDate: addDays(todayUtc(), -onsetDaysAgo),
      onsetPrecision: "exact",
    },
  });
  return flare.id;
}

describe("POST /api/flares/:id/close", () => {
  it("closes an open flare atomically with treatments and derived duration", async () => {
    actingUserId = await makeUser();
    const id = await makeOpenFlare(actingUserId, 10);

    const res = await closeFlare(
      req(`/api/flares/${id}/close`, "POST", {
        end_choice: "few_days_ago",
        peak_severity: 4,
        impact_note: "Missed two workdays.",
        symptom_note: "Swollen knees.",
        treatments: [
          { name: "Naproxen", start_choice: "flare_onset", helped: "yes" },
          { name: "Rest", start_choice: "few_days_in", helped: "unsure" },
        ],
      }),
      ctx(id),
    );
    expect(res.status).toBe(200);
    const { flare } = await res.json();
    expect(flare.status).toBe("closed");
    expect(flare.endPrecision).toBe("approx");
    expect(flare.peakSeverity).toBe(4);
    expect(flare.impactNote).toBe("Missed two workdays.");
    expect(flare.durationDays).toBeGreaterThan(0);
    expect(flare.treatments).toHaveLength(2);
    expect(flare.treatments[0].name).toBe("Naproxen");
  });

  it("returns 409 when the flare is already closed", async () => {
    actingUserId = await makeUser();
    const id = await makeOpenFlare(actingUserId, 10);
    await closeFlare(req(`/api/flares/${id}/close`, "POST", { end_choice: "today" }), ctx(id));
    const again = await closeFlare(
      req(`/api/flares/${id}/close`, "POST", { end_choice: "today" }),
      ctx(id),
    );
    expect(again.status).toBe(409);
  });

  it("rejects invalid payloads with 400", async () => {
    actingUserId = await makeUser();
    const sameDay = await makeOpenFlare(actingUserId, 0); // onset today

    const bad: unknown[] = [
      { end_choice: "whenever" }, // bad end choice
      { end_choice: "around_date", end_around_date: "2999-01-01" }, // future
      { end_choice: "today", severity: 5 }, // unknown field
      { end_choice: "today", impact_note: "x".repeat(1001) }, // oversize
      {
        end_choice: "today",
        treatments: Array.from({ length: 21 }, () => ({
          name: "T",
          start_choice: "unsure",
          helped: "unsure",
        })),
      }, // too many treatments
    ];
    for (const body of bad) {
      const id = await makeOpenFlare(actingUserId, 10);
      const res = await closeFlare(req(`/api/flares/${id}/close`, "POST", body), ctx(id));
      expect(res.status, JSON.stringify(body)).toBe(400);
    }

    // End before onset: onset today, "a few days ago" lands before it.
    const res = await closeFlare(
      req(`/api/flares/${sameDay}/close`, "POST", { end_choice: "few_days_ago" }),
      ctx(sameDay),
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 without a session and 404 for another user's flare", async () => {
    const owner = await makeUser();
    const id = await makeOpenFlare(owner, 10);

    actingUserId = null;
    const anon = await closeFlare(req(`/api/flares/${id}/close`, "POST", { end_choice: "today" }), ctx(id));
    expect(anon.status).toBe(401);

    actingUserId = await makeUser(); // a different user
    const cross = await closeFlare(req(`/api/flares/${id}/close`, "POST", { end_choice: "today" }), ctx(id));
    expect(cross.status).toBe(404);
  });

  it("returns 429 over the mutation limit", async () => {
    const prev = process.env.RATE_LIMIT_MUTATION_MAX;
    process.env.RATE_LIMIT_MUTATION_MAX = "3";
    try {
      actingUserId = await makeUser();
      let status = 0;
      for (let i = 0; i < 5; i++) {
        const id = await makeOpenFlare(actingUserId, 10);
        status = (
          await closeFlare(req(`/api/flares/${id}/close`, "POST", { end_choice: "today" }), ctx(id))
        ).status;
      }
      expect(status).toBe(429);
    } finally {
      if (prev === undefined) delete process.env.RATE_LIMIT_MUTATION_MAX;
      else process.env.RATE_LIMIT_MUTATION_MAX = prev;
    }
  });
});

describe("PATCH /api/flares/:id edit and reopen", () => {
  it("reopens a closed flare, clearing the end and keeping treatments", async () => {
    actingUserId = await makeUser();
    const id = await makeOpenFlare(actingUserId, 10);
    await closeFlare(
      req(`/api/flares/${id}/close`, "POST", {
        end_choice: "today",
        treatments: [{ name: "Naproxen", start_choice: "flare_onset", helped: "yes" }],
      }),
      ctx(id),
    );

    const res = await patchFlare(req(`/api/flares/${id}`, "PATCH", { reopen: true }), ctx(id));
    expect(res.status).toBe(200);
    const { flare } = await res.json();
    expect(flare.status).toBe("open");
    expect(flare.endDate).toBeNull();
    expect(flare.durationDays).toBeNull();
    expect(flare.treatments).toHaveLength(1);
  });

  it("corrects end, severity and notes on a closed flare", async () => {
    actingUserId = await makeUser();
    const id = await makeOpenFlare(actingUserId, 10);
    await closeFlare(req(`/api/flares/${id}/close`, "POST", { end_choice: "today" }), ctx(id));

    const res = await patchFlare(
      req(`/api/flares/${id}`, "PATCH", {
        peak_severity: 2,
        impact_note: "Better than last time.",
      }),
      ctx(id),
    );
    expect(res.status).toBe(200);
    const { flare } = await res.json();
    expect(flare.peakSeverity).toBe(2);
    expect(flare.impactNote).toBe("Better than last time.");
  });

  it("rejects editing end fields on an open flare with 400", async () => {
    actingUserId = await makeUser();
    const id = await makeOpenFlare(actingUserId, 10);
    const res = await patchFlare(
      req(`/api/flares/${id}`, "PATCH", { peak_severity: 3 }),
      ctx(id),
    );
    expect(res.status).toBe(400);
  });

  it("still accepts the legacy onset-only body and rejects extra fields", async () => {
    actingUserId = await makeUser();
    const id = await makeOpenFlare(actingUserId, 10);

    const ok = await patchFlare(
      req(`/api/flares/${id}`, "PATCH", { onset_choice: "few_days_ago" }),
      ctx(id),
    );
    expect(ok.status).toBe(200);
    expect((await ok.json()).flare.onsetPrecision).toBe("approx");

    const bad = await patchFlare(
      req(`/api/flares/${id}`, "PATCH", { onset_choice: "today", severity: 5 }),
      ctx(id),
    );
    expect(bad.status).toBe(400);
  });
});

describe("treatment CRUD", () => {
  it("adds, edits, and removes a treatment, each reflected on reload", async () => {
    actingUserId = await makeUser();
    const id = await makeOpenFlare(actingUserId, 10);

    const created = await addTreatment(
      req(`/api/flares/${id}/treatments`, "POST", {
        name: "Ibuprofen",
        start_choice: "few_days_in",
        helped: "no",
      }),
      ctx(id),
    );
    expect(created.status).toBe(201);
    const tid = (await created.json()).treatment.id;

    const edited = await patchTreatment(
      req(`/api/treatments/${tid}`, "PATCH", { helped: "yes", name: "Ibuprofen 400" }),
      ctx(tid),
    );
    expect(edited.status).toBe(200);
    expect((await edited.json()).treatment.helped).toBe("yes");

    let reload = await getFlare(req(`/api/flares/${id}`, "GET"), ctx(id));
    expect((await reload.json()).flare.treatments).toHaveLength(1);

    const removed = await delTreatment(req(`/api/treatments/${tid}`, "DELETE"), ctx(tid));
    expect(removed.status).toBe(204);

    reload = await getFlare(req(`/api/flares/${id}`, "GET"), ctx(id));
    expect((await reload.json()).flare.treatments).toHaveLength(0);
  });

  it("returns 404 for another user's treatment", async () => {
    const owner = await makeUser();
    const id = await makeOpenFlare(owner, 10);
    actingUserId = owner;
    const created = await addTreatment(
      req(`/api/flares/${id}/treatments`, "POST", {
        name: "Rest",
        start_choice: "flare_onset",
        helped: "yes",
      }),
      ctx(id),
    );
    const tid = (await created.json()).treatment.id;

    actingUserId = await makeUser();
    const patch = await patchTreatment(
      req(`/api/treatments/${tid}`, "PATCH", { helped: "no" }),
      ctx(tid),
    );
    expect(patch.status).toBe(404);
    const del = await delTreatment(req(`/api/treatments/${tid}`, "DELETE"), ctx(tid));
    expect(del.status).toBe(404);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const owner = await makeUser();
    const id = await makeOpenFlare(owner, 10);
    actingUserId = null;
    const res = await addTreatment(
      req(`/api/flares/${id}/treatments`, "POST", {
        name: "Rest",
        start_choice: "flare_onset",
        helped: "yes",
      }),
      ctx(id),
    );
    expect(res.status).toBe(401);
  });

  it("marks the derived end date around the picked day", async () => {
    actingUserId = await makeUser();
    const id = await makeOpenFlare(actingUserId, 10);
    const picked = toIsoDate(addDays(todayUtc(), -2));
    const res = await closeFlare(
      req(`/api/flares/${id}/close`, "POST", {
        end_choice: "around_date",
        end_around_date: picked,
      }),
      ctx(id),
    );
    const { flare } = await res.json();
    expect(flare.endDate).toBe(picked);
    expect(flare.endPrecision).toBe("approx");
  });
});
