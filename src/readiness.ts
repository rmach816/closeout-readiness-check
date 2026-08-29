import { ELECTRICAL_CHECKLIST } from "./checklist.js";
import type { Citation, ExtractedSource, ReadinessItem, SkippedSource } from "./types.js";

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[\u2010-\u2015]/g, "-").replace(/[^a-z0-9&]+/g, " ").replace(/\s+/g, " ").trim();
}
function hasAlternative(value: string, alternatives: string[]): boolean {
  const normalized = ` ${normalize(value)} `;
  return alternatives.some((alternative) => normalized.includes(` ${normalize(alternative)} `));
}
function snippet(value: string, item: { conceptGroups: string[][] }): string {
  const flattened = value.replace(/\s+/g, " ").trim();
  const positions = item.conceptGroups.flatMap((group) => group.map((term) => flattened.toLocaleLowerCase().indexOf(term.toLocaleLowerCase())).filter((index) => index >= 0));
  const anchor = positions.length > 0 ? Math.min(...positions) : 0;
  return flattened.slice(Math.max(0, anchor - 80), Math.min(flattened.length, anchor + 240));
}
function citation(source: ExtractedSource, item: { conceptGroups: string[][] }): Citation {
  return { path: source.relativePath, locator: source.locator, snippet: snippet(source.text, item) };
}
function isLeapYear(year: number): boolean { return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0); }
function validDate(year: number, month: number, day: number): boolean {
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (days[month - 1] ?? 0);
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const DATE_PATTERN = /\b(\d{4})-(\d{2})-(\d{2})\b|\b(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b|\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b|\b([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/g;

function dateFromMatch(match: RegExpMatchArray): boolean {
  let year = 0; let month = 0; let day = 0;
  if (match[1]) { year = Number(match[1]); month = Number(match[2]); day = Number(match[3]); }
  else if (match[4]) { month = Number(match[4]); day = Number(match[5]); year = Number(match[6]); year += year < 100 ? 2000 : 0; }
  else if (match[7]) { day = Number(match[7]); month = MONTHS.indexOf((match[8] ?? "").toLocaleLowerCase()) + 1; year = Number(match[9]); }
  else if (match[10]) { month = MONTHS.indexOf(match[10].toLocaleLowerCase()) + 1; day = Number(match[11]); year = Number(match[12]); }
  return validDate(year, month, day);
}

function findDateNearLabel(text: string, labels: string[]): string | undefined {
  const labelPattern = new RegExp(`\\b(?:${labels.map((label) => label.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")).join("|")})\\b`, "gi");
  const dateMatches = [...text.matchAll(DATE_PATTERN)];
  for (const labelMatch of text.matchAll(labelPattern)) {
    const labelEnd = (labelMatch.index ?? 0) + labelMatch[0].length;
    for (const dateMatch of dateMatches) {
      const dateStart = dateMatch.index ?? 0;
      if (Math.abs(dateStart - labelEnd) <= 160 && dateFromMatch(dateMatch)) return dateMatch[0];
    }
  }
  return undefined;
}

function pathMatchesAll(item: { conceptGroups: string[][] }, path: string): boolean {
  return item.conceptGroups.every((group) => hasAlternative(path, group));
}

function plausibleSkipped(item: { conceptGroups: string[][] }, skipped: SkippedSource[]): SkippedSource[] {
  return skipped.filter((source) => pathMatchesAll(item, source.path));
}

export function classifyReadiness(sources: ExtractedSource[], skipped: SkippedSource[], incompleteCoverage: boolean): ReadinessItem[] {
  const truncated = sources.filter((source) => source.truncated).map((source) => ({ path: source.relativePath, reason: "Extracted text was truncated" }));
  const unreadable = [...skipped, ...truncated];
  return ELECTRICAL_CHECKLIST.map((item) => {
    const matches = sources.filter((source) => !source.truncated && item.conceptGroups.every((group) => hasAlternative(`${source.relativePath} ${source.text}`, group)));
    if (matches.length > 0) {
      const dated = !item.dateRequired || matches.some((source) => findDateNearLabel(source.text, item.dateLabels));
      const best = matches.find((source) => !item.dateRequired || findDateNearLabel(source.text, item.dateLabels)) ?? matches[0]!;
      if (!dated) return { id: item.id, label: item.label, status: "date_not_detected", reason: "Readable evidence was found, but no valid Gregorian date was detected near an allowed date label in the same source.", citations: [citation(best, item)] };
      return { id: item.id, label: item.label, status: "found", reason: "Readable evidence matched every baseline concept group in one source.", citations: [citation(best, item)] };
    }
    const plausible = plausibleSkipped(item, unreadable);
    if (plausible.length > 0) return { id: item.id, label: item.label, status: "human_review_required", reason: "A plausible candidate matched every baseline concept group in its path but could not be read reliably.", citations: plausible.slice(0, 3).map((source) => ({ path: source.path, snippet: `Rule ${item.id}; filename/path candidate only. ${source.reason}` })) };
    if (incompleteCoverage) return { id: item.id, label: item.label, status: "human_review_required", reason: "Folder coverage is incomplete, so absence cannot be concluded for this baseline item.", citations: [{ path: ".", snippet: `Rule ${item.id}; selected-folder scope; incomplete scan coverage.` }] };
    return { id: item.id, label: item.label, status: "not_found_in_selected_folder", reason: "No readable evidence or plausible unreadable candidate was found in the selected folder.", citations: [{ path: ".", snippet: `Rule ${item.id}; selected-folder scope; patterns searched in readable sources.` }] };
  });
}
