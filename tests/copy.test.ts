import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Guards QUALITY BAR §8: user-visible copy must not carry the tells of
// machine-written text. We scan the UI source and seed copy for em-dashes,
// banned vocabulary, and negative empty-state phrasing.
const ROOTS = [
  "src/app",
  "src/components",
  "src/lib/seed.ts",
  "src/lib/display.ts",
  "src/lib/reconstruction.ts",
  "src/lib/covenant.ts",
];

// Static shell strings ship to users like any UI copy, so they are swept too.
const STATIC_COPY = ["public/offline.html", "public/manifest.webmanifest"];

const BANNED_WORDS = [
  "seamlessly", "effortlessly", "unlock", "elevate", "empower", "leverage",
  "robust", "dive in", "in today's fast-paced", "we've got you covered",
];
const NEGATIVE_PHRASES = [
  "you don't have", "no flares yet", "nothing here", "unable to",
  "something went wrong",
];

function collect(path: string): string[] {
  const stats = statSync(path);
  if (stats.isFile()) return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  return readdirSync(path).flatMap((child) => collect(join(path, child)));
}

const files = ROOTS.flatMap(collect);

describe("copy sweep", () => {
  it("scans a non-trivial set of files", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  function assertClean(text: string): void {
    const lower = text.toLowerCase();
    expect(text, "em-dash or en-dash").not.toMatch(/[—–]/);
    for (const word of BANNED_WORDS) {
      expect(lower, `banned vocabulary: ${word}`).not.toContain(word);
    }
    for (const phrase of NEGATIVE_PHRASES) {
      expect(lower, `negative phrasing: ${phrase}`).not.toContain(phrase);
    }
  }

  for (const file of files) {
    it(`is clean: ${file}`, () => {
      assertClean(readFileSync(file, "utf8"));
    });
  }

  for (const file of STATIC_COPY) {
    it(`is clean: ${file}`, () => {
      assertClean(readFileSync(file, "utf8"));
    });
  }
});
