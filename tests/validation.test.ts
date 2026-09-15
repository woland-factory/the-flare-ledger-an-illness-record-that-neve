import { describe, expect, it } from "vitest";
import {
  appointmentCorrectionSchema,
  appointmentCreateSchema,
  credentialsSchema,
  onsetSchema,
} from "@/lib/validation";
import { addDays, toIsoDate, todayUtc } from "@/lib/date";

describe("credentialsSchema", () => {
  it("accepts a valid email and password, lowercasing the email", () => {
    const r = credentialsSchema.safeParse({ email: "A@B.com", password: "longenough" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("a@b.com");
  });

  it("rejects a malformed email", () => {
    expect(credentialsSchema.safeParse({ email: "nope", password: "longenough" }).success).toBe(false);
  });

  it("rejects a short password", () => {
    expect(credentialsSchema.safeParse({ email: "a@b.com", password: "short" }).success).toBe(false);
  });

  it("rejects unexpected fields", () => {
    expect(
      credentialsSchema.safeParse({ email: "a@b.com", password: "longenough", admin: true }).success,
    ).toBe(false);
  });
});

describe("appointmentCreateSchema", () => {
  const today = toIsoDate(todayUtc());

  it("accepts a visit date with an optional trimmed specialty", () => {
    const r = appointmentCreateSchema.safeParse({
      visit_date: today,
      specialty: "  Rheumatology  ",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.specialty).toBe("Rheumatology");
    expect(appointmentCreateSchema.safeParse({ visit_date: today }).success).toBe(true);
  });

  it("rejects missing, malformed, and out-of-range visit dates", () => {
    expect(appointmentCreateSchema.safeParse({}).success).toBe(false);
    expect(appointmentCreateSchema.safeParse({ visit_date: "nope" }).success).toBe(false);
    expect(appointmentCreateSchema.safeParse({ visit_date: "2026-02-31" }).success).toBe(false);
    const past = toIsoDate(addDays(todayUtc(), -366));
    const future = toIsoDate(addDays(todayUtc(), 366));
    expect(appointmentCreateSchema.safeParse({ visit_date: past }).success).toBe(false);
    expect(appointmentCreateSchema.safeParse({ visit_date: future }).success).toBe(false);
    const edge = toIsoDate(addDays(todayUtc(), 365));
    expect(appointmentCreateSchema.safeParse({ visit_date: edge }).success).toBe(true);
  });

  it("rejects unknown fields and an oversize or empty specialty", () => {
    expect(
      appointmentCreateSchema.safeParse({ visit_date: today, admin: true }).success,
    ).toBe(false);
    expect(
      appointmentCreateSchema.safeParse({ visit_date: today, specialty: "x".repeat(81) })
        .success,
    ).toBe(false);
    expect(
      appointmentCreateSchema.safeParse({ visit_date: today, specialty: "  " }).success,
    ).toBe(false);
  });
});

describe("appointmentCorrectionSchema", () => {
  const today = toIsoDate(todayUtc());

  it("accepts each op with its required fields", () => {
    const ok = [
      { op: "set_visit", visit_date: today },
      { op: "set_visit", specialty: null },
      { op: "set_flare", key: "k", peak_severity: 4 },
      { op: "set_flare", key: "k", end_date: null },
      {
        op: "set_flare",
        key: "k",
        onset_date: "2026-09-01",
        onset_precision: "approx",
      },
      {
        op: "set_flare",
        key: "k",
        treatments: [
          { name: "Naproxen", startedOn: "2026-09-02", startedPrecision: "exact", helped: "yes" },
          { name: "Rest", startedOn: null, startedPrecision: null, helped: null },
        ],
      },
      { op: "add_flare", onset_date: "2026-09-01", onset_precision: "exact" },
      {
        op: "add_flare",
        onset_date: "2026-09-01",
        onset_precision: "exact",
        end_date: "2026-09-04",
        end_precision: "approx",
        peak_severity: null,
        note: "Short one.",
      },
      { op: "remove_flare", key: "k" },
    ];
    for (const body of ok) {
      expect(appointmentCorrectionSchema.safeParse(body).success, JSON.stringify(body)).toBe(true);
    }
  });

  it("rejects malformed ops", () => {
    const bad = [
      { op: "improve_wording" },
      { op: "set_visit" }, // no fields
      { op: "set_visit", visit_date: "2019-01-01" }, // out of range
      { op: "set_flare", key: "k" }, // nothing beyond the key
      { op: "set_flare", key: "k", onset_date: "2026-09-01" }, // precision missing
      { op: "set_flare", key: "k", end_date: "2026-09-04" }, // precision missing
      { op: "set_flare", key: "k", peak_severity: 6 },
      { op: "set_flare", key: "k", note: "x".repeat(301) },
      {
        op: "set_flare",
        key: "k",
        treatments: Array.from({ length: 21 }, () => ({
          name: "T",
          startedOn: null,
          startedPrecision: null,
          helped: null,
        })),
      },
      {
        op: "set_flare",
        key: "k",
        treatments: [
          { name: "T", startedOn: "2026-09-01", startedPrecision: null, helped: null },
        ],
      }, // a recorded start needs its precision
      { op: "add_flare", onset_date: "2026-09-01" }, // precision missing
      { op: "add_flare", onset_date: "2026-09-01", onset_precision: "exact", extra: 1 },
      { op: "remove_flare" },
    ];
    for (const body of bad) {
      expect(appointmentCorrectionSchema.safeParse(body).success, JSON.stringify(body)).toBe(false);
    }
  });
});

describe("onsetSchema", () => {
  it("accepts a known choice", () => {
    expect(onsetSchema.safeParse({ onset_choice: "today" }).success).toBe(true);
  });

  it("rejects an unknown choice", () => {
    expect(onsetSchema.safeParse({ onset_choice: "whenever" }).success).toBe(false);
  });

  it("rejects unexpected fields", () => {
    expect(
      onsetSchema.safeParse({ onset_choice: "today", severity: 5 }).success,
    ).toBe(false);
  });
});
