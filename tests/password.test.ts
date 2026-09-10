import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("produces an argon2id hash that verifies", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "correct horse battery")).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });

  it("returns false for a malformed hash rather than throwing", async () => {
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
  });
});
