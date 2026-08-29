import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { auditFolder } from "../src/audit.js";
import { classifyReadiness } from "../src/readiness.js";
import type { ExtractedSource } from "../src/types.js";

test("classifies a readable electrical baseline with valid dates", async () => {
  const root = await mkdtemp(join(tmpdir(), "closeout-readiness-"));
  await writeFile(join(root, "electrical-closeout.txt"), [
    "One-line as-built record drawing. Revision date: 2026-08-01.",
    "Panel schedules for panel and circuit. Revision date: 08/01/2026.",
    "Electrical acceptance testing commissioning report. Test date: August 1, 2026.",
    "Electrical O&M operations and maintenance equipment manuals.",
    "Electrical equipment warranty. Effective date: 2026-08-01.",
    "Spare parts and attic stock material turnover.",
    "Owner training attendance and completion record. Completion date: 2026-08-01."
  ].join("\n"));
  const result = await auditFolder(root);
  assert.equal(result.items.length, 7);
  assert.equal(result.all_baseline_items_found, true);
  assert.equal(result.items.filter((item) => item.status === "found").length, 7);
  assert.ok(result.items.every((item) => item.citations.length > 0));
});

test("does not accept year-only dates", async () => {
  const root = await mkdtemp(join(tmpdir(), "closeout-date-"));
  await writeFile(join(root, "panel-schedule.txt"), "Panel schedules for panel and circuit. Revision date: 2026.");
  const result = await auditFolder(root);
  assert.equal(result.items.find((item) => item.id === "panel_schedules")?.status, "date_not_detected");
});

test("requires human review when a plausible unreadable candidate is skipped", async () => {
  const root = await mkdtemp(join(tmpdir(), "closeout-skip-"));
  await writeFile(join(root, "electrical-warranty.pdf"), Buffer.from("not a PDF"));
  const result = await auditFolder(root);
  assert.equal(result.items.find((item) => item.id === "warranties")?.status, "human_review_required");
});

test("incomplete coverage never becomes a false-ready result", async () => {
  const root = await mkdtemp(join(tmpdir(), "closeout-limit-"));
  await mkdir(join(root, "panel-schedules"));
  for (let i = 0; i < 101; i += 1) await writeFile(join(root, `panel-schedules/file-${i}.txt`), "unrelated");
  const result = await auditFolder(root);
  assert.equal(result.all_baseline_items_found, false);
  assert.ok(result.items.some((item) => item.status === "human_review_required"));
});

const source = (path: string, text: string, truncated = false): ExtractedSource => ({ relativePath: path, extension: ".txt", text, truncated, modifiedAt: "2026-08-29T00:00:00.000Z" });

test("skipped candidates require every concept group and scan-only files never become found/date-ready", () => {
  const warrantyOnly = classifyReadiness([], [{ path: "warranty.pdf", reason: "PDF contains no text layer" }], false);
  assert.equal(warrantyOnly.find((item) => item.id === "warranties")?.status, "not_found_in_selected_folder");
  const imageCandidate = classifyReadiness([], [{ path: "electrical-warranty-equipment.png", reason: "Unsupported file type .png" }], false);
  assert.equal(imageCandidate.find((item) => item.id === "warranties")?.status, "human_review_required");
  const truncated = classifyReadiness([source("panel-schedules-panel-circuit.txt", "Panel schedules for panel and circuit. Revision date: 2026-08-01.", true)], [], false);
  assert.equal(truncated.find((item) => item.id === "panel_schedules")?.status, "human_review_required");
});

test("uses exact labels, real calendar dates, and the best later dated source", () => {
  const first = source("panel-schedule-first.txt", "Panel schedules for panel and circuit. Date: 2026-08-01.");
  const second = source("panel-schedule-final.txt", "Panel schedules for panel and circuit. Revision date: 2026-08-01.");
  assert.equal(classifyReadiness([first, second], [], false).find((item) => item.id === "panel_schedules")?.status, "found");
  const invalid = classifyReadiness([source("warranty.txt", "Electrical equipment warranty. Effective date: 2026-02-29.")], [], false);
  assert.equal(invalid.find((item) => item.id === "warranties")?.status, "date_not_detected");
  const far = "Electrical equipment warranty. Effective date: " + "x".repeat(161) + " 2026-08-01.";
  assert.equal(classifyReadiness([source("warranty.txt", far)], [], false).find((item) => item.id === "warranties")?.status, "date_not_detected");
  assert.equal(classifyReadiness([source("training.txt", "Owner training attendance. Event date: 8/1/26.")], [], false).find((item) => item.id === "training_record")?.status, "found");
  assert.equal(classifyReadiness([source("testing.txt", "Electrical acceptance testing report. Report date: 1 August 2026.")], [], false).find((item) => item.id === "acceptance_testing")?.status, "found");
});

test("requires acceptance, testing/report, and electrical concepts in one source", () => {
  const split = [source("acceptance.txt", "Acceptance electrical"), source("testing.txt", "Testing report")];
  assert.equal(classifyReadiness(split, [], false).find((item) => item.id === "acceptance_testing")?.status, "not_found_in_selected_folder");
  const complete = classifyReadiness([source("acceptance.txt", "Electrical acceptance testing report. Test date: 2026-08-01.")], [], false);
  assert.equal(complete.find((item) => item.id === "acceptance_testing")?.status, "found");
});

test("uses token boundaries and accepts four-digit Gregorian years outside the 2000s", () => {
  const embedded = classifyReadiness([source("warrantying.txt", "Electrical equipment warrantying. Effective date: 2026-08-01.")], [], false);
  assert.equal(embedded.find((item) => item.id === "warranties")?.status, "not_found_in_selected_folder");
  const historical = classifyReadiness([source("record-drawing.txt", "One-line as-built record drawing. Issue date: 15 March 1998.")], [], false);
  assert.equal(historical.find((item) => item.id === "one_line_as_built")?.status, "found");
});

test("classifier output is deterministic", () => {
  const inputs = [source("panel-schedule.txt", "Panel schedules for panel and circuit. Revision date: 2026-08-01.")];
  assert.deepEqual(classifyReadiness(inputs, [], false), classifyReadiness(inputs, [], false));
});

test("public-reference multi-format synthetic package produces six found rows and one human-review warranty", async () => {
  const root = fileURLToPath(new URL("../fixtures/synthetic-electrical-closeout-package/", import.meta.url));
  const result = await auditFolder(root);
  assert.equal(result.items.length, 7);
  assert.equal(result.all_baseline_items_found, false);
  assert.equal(result.items.filter((item) => item.status === "found").length, 6);
  assert.equal(result.items.find((item) => item.id === "warranties")?.status, "human_review_required");
  assert.ok(result.items.filter((item) => item.status === "found").every((item) => item.citations.length > 0));
});
