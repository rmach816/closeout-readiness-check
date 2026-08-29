import type { ChecklistItem } from "./types.js";

/** Fixed electrical baseline. This is a public-reference starting point, not contract interpretation. */
export const ELECTRICAL_CHECKLIST: ChecklistItem[] = [
  { id: "one_line_as_built", label: "One-line / riser as-built", dateRequired: true, dateLabels: ["revision date", "issue date"], conceptGroups: [["one-line", "one line", "single-line", "single line", "riser"], ["as-built", "as built", "record drawing", "record"]] },
  { id: "panel_schedules", label: "Panel schedules", dateRequired: true, dateLabels: ["revision date", "issue date"], conceptGroups: [["panel schedule", "panel schedules"], ["panel", "circuit"]] },
  { id: "acceptance_testing", label: "Acceptance testing", dateRequired: true, dateLabels: ["test date", "report date"], conceptGroups: [["acceptance", "commissioning", "neta"], ["test", "testing", "report"], ["electrical", "switchgear", "power", "lighting"]] },
  { id: "om_manuals", label: "O&M manuals", dateRequired: false, dateLabels: [], conceptGroups: [["o&m", "o & m", "operation and maintenance", "operations and maintenance"], ["electrical", "equipment", "switchgear", "lighting"]] },
  { id: "warranties", label: "Warranties", dateRequired: true, dateLabels: ["issue date", "effective date"], conceptGroups: [["warranty", "warranties", "guarantee"], ["electrical", "equipment", "switchgear", "lighting"]] },
  { id: "spare_parts", label: "Spare parts / attic stock", dateRequired: false, dateLabels: [], conceptGroups: [["spare parts", "spare-part", "attic stock", "material turnover"]], },
  { id: "training_record", label: "Training record", dateRequired: true, dateLabels: ["event date", "completion date"], conceptGroups: [["training"], ["attendance", "completion", "owner", "attendees"]] }
];
