import type { FlareDTO } from "./serialize";

// One row per treatment; a treatment-less flare still gets a row with the
// treatment columns empty. Column order is the export contract.
const COLUMNS = [
  "onset_date",
  "onset_precision",
  "end_date",
  "end_precision",
  "duration_days",
  "peak_severity",
  "status",
  "impact_note",
  "symptom_note",
  "treatment_name",
  "treatment_started_on",
  "treatment_started_precision",
  "treatment_helped",
  "treatment_note",
] as const;

// Spreadsheet formula-injection guard: a field a spreadsheet could execute is
// prefixed with a single quote so it stays literal text. User-controlled names
// and notes make this mandatory.
function neutralize(value: string): string {
  if (value.length > 0 && /^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}

// RFC 4180: quote a field only when it carries a comma, quote, CR, or LF, and
// double any internal quotes. Injection guard runs first, then quoting.
function encode(value: string): string {
  const guarded = neutralize(value);
  if (/[",\r\n]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return encode(String(value));
}

export function flaresToCsv(flares: FlareDTO[]): string {
  const rows: string[] = [COLUMNS.map(encode).join(",")];
  for (const flare of flares) {
    const base = [
      flare.onsetDate,
      flare.onsetPrecision,
      flare.endDate,
      flare.endPrecision,
      flare.durationDays,
      flare.peakSeverity,
      flare.status,
      flare.impactNote,
      flare.symptomNote,
    ];
    const treatments = flare.treatments ?? [];
    if (treatments.length === 0) {
      rows.push([...base, null, null, null, null, null].map(cell).join(","));
      continue;
    }
    for (const t of treatments) {
      rows.push(
        [...base, t.name, t.startedOn, t.startedPrecision, t.helped, t.note]
          .map(cell)
          .join(","),
      );
    }
  }
  return rows.join("\r\n");
}
