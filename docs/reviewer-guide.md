# Closeout Readiness Check reviewer guide

Closeout Readiness Check exposes three MCP tools: `check_closeout_folder`, `manage_closeout_subscription`, and `show_recovery_key`. The first reads only the configured folder and returns cited baseline statuses. It never writes to the selected folder. Scanning is local; findings, cited paths, and short excerpts are returned to Claude and may be processed by Anthropic. Project documents and report excerpts are not sent to M2 AI's billing service. The fixed electrical baseline is not contract interpretation, certification, or acceptance.

For review, use the synthetic fixtures and run `npm run check`. Inspect the manifest and package with `npx --yes @anthropic-ai/mcpb validate manifest.json`, then `npm run pack` and `npm run package:check`. Provider, marketplace, and installed-Desktop checks are separate release gates.
