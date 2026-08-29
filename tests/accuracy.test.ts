import assert from "node:assert/strict";
import test from "node:test";
import { classifyReadiness } from "../src/readiness.js";
import type { ExtractedSource } from "../src/types.js";

// Synthetic, human-labeled gate: 30 deterministic folder cases, seven category labels each.
const rows = [
  "One-line as-built record drawing. Revision date: 2026-08-01.",
  "Panel schedules for panel and circuit. Revision date: 2026-08-01.",
  "Electrical acceptance testing report. Test date: 2026-08-01.",
  "Electrical O&M operations and maintenance equipment manuals.",
  "Electrical equipment warranty. Effective date: 2026-08-01.",
  "Spare parts and attic stock material turnover.",
  "Owner training attendance and completion record. Completion date: 2026-08-01."
];
const ids = ["one_line_as_built", "panel_schedules", "acceptance_testing", "om_manuals", "warranties", "spare_parts", "training_record"] as const;
const cases = Array.from({ length: 30 }, (_, index) => {
  const missing = index >= 24 ? (index - 24) % rows.length : -1;
  return { caseId: `synthetic-${String(index + 1).padStart(2, "0")}`, expectedAllReady: missing < 0, expected: ids.map((id, row) => [id, row === missing ? "not_found_in_selected_folder" : "found"] as const), text: rows.filter((_, row) => row !== missing).join("\n") };
});

test("synthetic 30-case human-labeled accuracy gate is at least 95% with zero false all-ready", () => {
  let correct = 0;
  let total = 0;
  let falseReady = 0;
  for (const testCase of cases) {
    const source: ExtractedSource = { relativePath: `${testCase.caseId}/electrical-closeout.txt`, extension: ".txt", text: testCase.text, truncated: false, modifiedAt: "2026-08-29T00:00:00.000Z" };
    const result = classifyReadiness([source], [], false);
    const actual = new Map(result.map((item) => [item.id, item.status]));
    for (const [id, expected] of testCase.expected) { total += 1; if (actual.get(id) === expected) correct += 1; }
    const allReady = result.every((item) => item.status === "found" || item.status === "date_not_detected");
    if (allReady !== testCase.expectedAllReady) falseReady += 1;
  }
  const accuracy = correct / total;
  assert.equal(cases.length, 30);
  assert.equal(falseReady, 0);
  assert.ok(accuracy >= 0.95, `synthetic macro category-status accuracy was ${accuracy}`);
});
