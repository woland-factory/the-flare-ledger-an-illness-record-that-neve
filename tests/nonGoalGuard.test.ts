import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// The product's whole thesis is that it never nags on a schedule and never
// charts the user's data. This guard fails loudly if either paradigm sneaks
// into the app or component source, so a later change cannot quietly betray it.
const ROOTS = ["src/app", "src/components"];

// Mechanical markers: scheduling primitives and charting libraries. These can
// only appear in real code, never in marketing prose, so they are scanned
// against the raw source.
const MECHANICAL: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /setinterval/i, label: "setInterval (a timed nudge)" },
  { pattern: /settimeout\s*\([^,]+,\s*\d{4,}/i, label: "long setTimeout (a delayed nudge)" },
  { pattern: /\bcron\b/i, label: "cron scheduler" },
  { pattern: /new\s+Notification|Notification\.requestPermission|showNotification/i, label: "scheduled notification" },
  { pattern: /recharts|chart\.js|chartjs|\bd3\b|victory|nivo/i, label: "charting library" },
  // EPIC 3 boundaries: the ledger is one newest-first list, not a filtering
  // dashboard, and every read is scoped to the signed-in user.
  { pattern: /type=["']search["']/i, label: "search input (a filter control)" },
  { pattern: /\bfacet(ing|s)?\b/i, label: "faceting control" },
  { pattern: /filter(By|Flares|Controls?)/i, label: "ledger filter control" },
  { pattern: /share[_-]?token|shareToken|public[_-]?link|clinician[_-]?view/i, label: "cross-user or share read path" },
];

// Paradigm markers: a streak, daily check-in, reminder, or trend/correlation
// chart. The app's own copy names some of these to reject them ("No daily
// check-ins"), so we scan CODE only, blanking string and JSX-text content
// first. A real feature would leave an identifier or import behind.
const PARADIGM: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bstreak/i, label: "streak" },
  { pattern: /daily[\s_-]?check[\s_-]?in/i, label: "daily check-in" },
  { pattern: /\breminder/i, label: "reminder" },
  { pattern: /\bchart\b/i, label: "chart" },
  { pattern: /trend[\s_-]?line/i, label: "trend line" },
  { pattern: /\bcorrelat/i, label: "correlation view" },
];

function stripCopy(text: string): string {
  return text
    .replace(/`[^`]*`/g, " ")
    .replace(/"[^"]*"/g, " ")
    .replace(/'[^']*'/g, " ")
    .replace(/>[^<>{}]*</g, "><");
}

function collect(path: string): string[] {
  const stats = statSync(path);
  if (stats.isFile()) return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  return readdirSync(path).flatMap((child) => collect(join(path, child)));
}

const files = ROOTS.flatMap(collect);

describe("non-goal guard", () => {
  it("scans a non-trivial set of files", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    it(`introduces no scheduled prompt or chart: ${file}`, () => {
      const raw = readFileSync(file, "utf8");
      for (const { pattern, label } of MECHANICAL) {
        expect(pattern.test(raw), `${label} found in ${file}`).toBe(false);
      }
      const code = stripCopy(raw);
      for (const { pattern, label } of PARADIGM) {
        expect(pattern.test(code), `${label} found in ${file}`).toBe(false);
      }
    });
  }
});
