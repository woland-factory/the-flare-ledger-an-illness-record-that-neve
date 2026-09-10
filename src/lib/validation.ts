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

export type CredentialsInput = z.infer<typeof credentialsSchema>;
export type OnsetInput = z.infer<typeof onsetSchema>;
