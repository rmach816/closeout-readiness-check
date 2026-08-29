# Synthetic Electrical Closeout Package

This fixture is a reproducible engineering test, not a customer project and not evidence of market demand or real-world usefulness. Every record is fictional and contains no customer, contractor, or project data.

The package shape follows the v1 public-reference categories documented in the governing specification: one-line record drawing, panel schedules, electrical acceptance testing, O&M material, equipment warranty, spare-parts turnover, and owner-training record. It intentionally makes the warranty a scan-only PDF with no text layer. The expected result is six cited `found` rows, one warranty `human_review_required`, and `all_baseline_items_found: false`.

Regenerate it with `npm run fixture:closeout`. Verify it through `npm run check` and a direct `auditFolder("fixtures/synthetic-electrical-closeout-package")` run. The first authorized beta/customer folder remains required before public launch because self-created fixtures cannot prove real-world usefulness.
