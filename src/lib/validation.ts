import { z } from "zod";
import { daysBetween, parseIsoDate, todayUtc } from "./date";
import { snapshotTreatmentSchema } from "./reconstruction";

export const credentialsSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320),
    password: z.string().min(8).max(200),
  })
  .strict();

export const onsetSchema = z
  .object({
    onset_choice: z.enum(["today", "few_days_ago", "around_date"]),
    around_date: z.string().optional(),
  })
  .strict();

// One treatment as submitted through the interview or the treatment routes.
export const treatmentInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    start_choice: z.enum(["flare_onset", "few_days_in", "around_date", "unsure"]),
    start_around_date: z.string().optional(),
    helped: z.enum(["yes", "no", "unsure"]),
    note: z.string().max(1000).optional(),
  })
  .strict();

// The whole flare-end interview, submitted in one request to close atomically.
export const closeSchema = z
  .object({
    end_choice: z.enum(["today", "few_days_ago", "around_date"]),
    end_around_date: z.string().optional(),
    peak_severity: z.number().int().min(1).max(5).nullable().optional(),
    impact_note: z.string().max(1000).optional(),
    symptom_note: z.string().max(1000).optional(),
    treatments: z.array(treatmentInputSchema).max(20).optional(),
  })
  .strict();

// Partial edit of a flare after the fact. Every field is optional, but at least
// one must be present, and reopening cannot be combined with a new end date.
export const flareEditSchema = z
  .object({
    onset_choice: z.enum(["today", "few_days_ago", "around_date"]).optional(),
    around_date: z.string().optional(),
    end_choice: z.enum(["today", "few_days_ago", "around_date"]).optional(),
    end_around_date: z.string().optional(),
    peak_severity: z.number().int().min(1).max(5).nullable().optional(),
    impact_note: z.string().max(1000).optional(),
    symptom_note: z.string().max(1000).optional(),
    reopen: z.literal(true).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: "no_fields" })
  .refine((d) => !(d.reopen && (d.end_choice !== undefined || d.end_around_date !== undefined)), {
    message: "reopen_with_end",
  });

// Edit of a single treatment. Optional fields, at least one present.
export const treatmentEditSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    start_choice: z.enum(["flare_onset", "few_days_in", "around_date", "unsure"]).optional(),
    start_around_date: z.string().optional(),
    helped: z.enum(["yes", "no", "unsure"]).optional(),
    note: z.string().max(1000).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: "no_fields" });

// The ledger list query: an optional page size and an opaque keyset cursor.
// Query params arrive as strings, so limit is coerced; unknown params rejected.
export const flareListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).optional(),
    before: z.string().min(1).max(80).optional(),
  })
  .strict();

// The export format selector. Missing or unknown value is a 400.
export const exportQuerySchema = z
  .object({
    format: z.enum(["json", "csv"]),
  })
  .strict();

// A visit date must be a real calendar date within a year either way of
// today: enough to log a visit just past or a year ahead, tight enough to
// catch typos.
const visitDateSchema = z.string().refine(
  (v) => {
    const d = parseIsoDate(v);
    return d !== null && Math.abs(daysBetween(todayUtc(), d)) <= 365;
  },
  { message: "bad_visit_date" },
);

export const appointmentCreateSchema = z
  .object({
    visit_date: visitDateSchema,
    specialty: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

const isoDayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const precisionSchema = z.enum(["exact", "approx"]);
const severitySchema = z.number().int().min(1).max(5).nullable();

const setVisitSchema = z
  .object({
    op: z.literal("set_visit"),
    visit_date: visitDateSchema.optional(),
    specialty: z.string().trim().min(1).max(80).nullable().optional(),
  })
  .strict()
  .refine((d) => d.visit_date !== undefined || d.specialty !== undefined, {
    message: "no_fields",
  });

// Shared field rules for editing or adding a snapshot flare. Cross-field
// rules that need the merged flare (order, future dates) live in
// applyCorrection; these keep the shapes tight at the boundary.
const setFlareSchema = z
  .object({
    op: z.literal("set_flare"),
    key: z.string().min(1).max(80),
    onset_date: isoDayString.optional(),
    onset_precision: precisionSchema.optional(),
    end_date: isoDayString.nullable().optional(),
    end_precision: precisionSchema.optional(),
    peak_severity: severitySchema.optional(),
    note: z.string().max(300).nullable().optional(),
    treatments: z.array(snapshotTreatmentSchema).max(20).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 2, { message: "no_fields" })
  .refine((d) => (d.onset_date === undefined) === (d.onset_precision === undefined), {
    message: "onset_precision_required",
  })
  .refine((d) => (typeof d.end_date === "string") === (d.end_precision !== undefined), {
    message: "end_precision_required",
  });

const addFlareSchema = z
  .object({
    op: z.literal("add_flare"),
    onset_date: isoDayString,
    onset_precision: precisionSchema,
    end_date: isoDayString.nullable().optional(),
    end_precision: precisionSchema.optional(),
    peak_severity: severitySchema.optional(),
    note: z.string().max(300).nullable().optional(),
    treatments: z.array(snapshotTreatmentSchema).max(20).optional(),
  })
  .strict()
  .refine((d) => (typeof d.end_date === "string") === (d.end_precision !== undefined), {
    message: "end_precision_required",
  });

const removeFlareSchema = z
  .object({
    op: z.literal("remove_flare"),
    key: z.string().min(1).max(80),
  })
  .strict();

// One validated correction per request: one tap, one save.
export const appointmentCorrectionSchema = z.union([
  setVisitSchema,
  setFlareSchema,
  addFlareSchema,
  removeFlareSchema,
]);

export type CredentialsInput = z.infer<typeof credentialsSchema>;
export type OnsetInput = z.infer<typeof onsetSchema>;
export type TreatmentInput = z.infer<typeof treatmentInputSchema>;
export type CloseInput = z.infer<typeof closeSchema>;
export type FlareEditInput = z.infer<typeof flareEditSchema>;
export type TreatmentEditInput = z.infer<typeof treatmentEditSchema>;
export type AppointmentCreateInput = z.infer<typeof appointmentCreateSchema>;
export type AppointmentCorrectionInput = z.infer<typeof appointmentCorrectionSchema>;
