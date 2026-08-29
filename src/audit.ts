import { inventoryProject } from "./inventory.js";
import { classifyReadiness } from "./readiness.js";
import type { ReadinessResult } from "./types.js";

export async function auditFolder(projectRoot: string): Promise<ReadinessResult> {
  const inventory = await inventoryProject(projectRoot);
  const items = classifyReadiness(inventory.sources, inventory.skipped, inventory.coverageIncomplete);
  const allBaseline = items.every((item) => item.status === "found" || item.status === "date_not_detected");
  const dateIssues = items.filter((item) => item.status === "date_not_detected").map((item) => item.label);
  const humanIssues = items.filter((item) => item.status === "human_review_required").map((item) => item.label);
  const absent = items.filter((item) => item.status === "not_found_in_selected_folder").map((item) => `${item.label} not found`);
  const summary = allBaseline
    ? dateIssues.length > 0 ? `Readable baseline evidence was found. Date review remains: ${dateIssues.join(", ")}.` : "Readable baseline evidence was found for every electrical baseline item. Human review is still required."
    : `The selected folder is not ready for human closeout review: ${[...absent, ...humanIssues.map((item) => `${item} needs human review`)].join("; ")}.`;
  const limitations = [
    "This is a public-reference electrical baseline, not a contract interpretation, certification, or acceptance decision.",
    "Only readable text in the selected folder was evaluated. Image-only files, unreadable files, omitted records, and external systems are not evaluated.",
    "A found item does not prove the document is current, accurate, complete, signed, or acceptable to a project owner or authority.",
    "Human review is required before submission, pricing, notice, approval, or legal action."
  ];
  if (inventory.limitReached) limitations.push("The scan stopped at an input limit, so unresolved categories are conservatively marked for human review.");
  if (inventory.coverageIncomplete && !inventory.limitReached) limitations.push("At least one folder entry could not be traversed or inspected, so unresolved categories are conservatively marked for human review.");
  return {
    project: inventory.project, checkedAt: new Date().toISOString(), scannedSources: inventory.scannedFiles,
    skippedSources: inventory.skipped, truncatedSources: [...new Set(inventory.sources.filter((source) => source.truncated).map((source) => source.relativePath))],
    items, all_baseline_items_found: allBaseline, summary, limitations,
    humanReviewRequired: "Human review is required before a closeout package is submitted or treated as complete."
  };
}
