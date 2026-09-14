import { z } from "zod";

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

export type CredentialsInput = z.infer<typeof credentialsSchema>;
export type OnsetInput = z.infer<typeof onsetSchema>;
export type TreatmentInput = z.infer<typeof treatmentInputSchema>;
export type CloseInput = z.infer<typeof closeSchema>;
export type FlareEditInput = z.infer<typeof flareEditSchema>;
export type TreatmentEditInput = z.infer<typeof treatmentEditSchema>;
