export type BaselineStatus = "found" | "date_not_detected" | "human_review_required" | "not_found_in_selected_folder";

export interface Citation { path: string; locator?: string; snippet: string; }
export interface ExtractedSource { relativePath: string; extension: string; text: string; locator?: string; truncated: boolean; modifiedAt: string; }
export interface SkippedSource { path: string; reason: string; }
export interface ChecklistItem { id: string; label: string; dateRequired: boolean; conceptGroups: string[][]; dateLabels: string[]; }
export interface ReadinessItem { id: string; label: string; status: BaselineStatus; reason: string; citations: Citation[]; }
export interface ReadinessResult {
  project: string; checkedAt: string; scannedSources: number; skippedSources: SkippedSource[]; truncatedSources: string[];
  items: ReadinessItem[]; all_baseline_items_found: boolean; summary: string; limitations: string[]; humanReviewRequired: string;
}
