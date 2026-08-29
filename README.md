# Closeout Readiness Check

Closeout Readiness Check is a local Claude Desktop extension for electrical subcontractor project managers. It checks one selected folder against a fixed public-reference electrical closeout baseline and returns cited pre-submission findings for human review.

## Current state

The local MVP is implemented and independently testable. There is no provider configuration, credential, customer data, deployment, or public release in this folder. The public-reference synthetic-package proof is local only; the first authorized beta/customer folder, final legal, provider, and release gates remain open. No paid SEO service is required.

The governing specification is [`../../docs/build-spec-claude-closeout-readiness-check-v0.1.md`](../../docs/build-spec-claude-closeout-readiness-check-v0.1.md). Product-only current state is in [`docs/project-state.md`](docs/project-state.md).

## Isolation boundary

This is not part of any other portfolio product. It must have its own source, public repository, Stripe account context, Vercel project, domain, signing namespace, local state directory, tests, package, and release evidence. Proven patterns may be copied, but no code, credential, data store, provider resource, or runtime is shared.

## Privacy Policy

See https://closeoutcheck.m2ai.tech/privacy. Final legal text is an owner/attorney-review draft and must match the shipped data and billing behavior before release.
