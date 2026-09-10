import { describe, expect, it } from "vitest";
import { authLimit, checkRateLimit, mutationLimit } from "@/lib/rateLimit";

describe("checkRateLimit", () => {
  it("allows up to max within a window, then blocks", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("k1", 5, 60_000, now).ok).toBe(true);
    }
    expect(checkRateLimit("k1", 5, 60_000, now).ok).toBe(false);
  });

  it("resets after the window elapses", () => {
    expect(checkRateLimit("k2", 1, 1_000, 0).ok).toBe(true);
    expect(checkRateLimit("k2", 1, 1_000, 0).ok).toBe(false);
    expect(checkRateLimit("k2", 1, 1_000, 2_000).ok).toBe(true);
  });

  it("keeps separate keys independent", () => {
    expect(checkRateLimit("ip:a", 1, 60_000, 0).ok).toBe(true);
    expect(checkRateLimit("ip:b", 1, 60_000, 0).ok).toBe(true);
  });

  it("exposes the documented defaults", () => {
    expect(authLimit().max).toBe(10);
    expect(mutationLimit().max).toBe(60);
  });
});
