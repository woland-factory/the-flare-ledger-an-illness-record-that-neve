import { describe, expect, it } from "vitest";
import { credentialsSchema, onsetSchema } from "@/lib/validation";

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
