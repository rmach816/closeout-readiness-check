# Closeout Readiness Check reviewer guide

For support or reviewer correspondence, contact richard@m2ai.tech. Do not use the owner's personal sign-in address as a product contact.

Closeout Readiness Check exposes three MCP tools: `check_closeout_folder`, `manage_closeout_subscription`, and `show_recovery_key`. The first reads only the configured folder and returns cited baseline statuses. It never writes to the selected folder. Scanning is local; findings, cited paths, and short excerpts are returned to Claude and may be processed by Anthropic. Project documents and report excerpts are not sent to M2 AI's billing service. The fixed electrical baseline is not contract interpretation, certification, or acceptance.

For review, use the synthetic fixtures and run `npm run check`. Inspect the manifest and package with `npx --yes @anthropic-ai/mcpb validate manifest.json`, then `npm run pack` and `npm run package:check`. Provider, marketplace, and installed-Desktop checks are separate release gates.

Version 0.1.3 uses live billing. Install the current package and run the check to obtain a mode-matched activation link; an already-used free check returns a new link without resetting its allowance. Earlier beta links cannot create live checkout. A purchase is optional, costs $99/month or $990/year, and automatically activates the purchasing computer. Do not enter a real payment for reviewer smoke testing. The owner-reported directory submission used beta.2; that submitted artifact remains preserved, and directory acceptance is not implied by this release.
