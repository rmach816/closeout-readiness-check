# Closeout Readiness Check

Closeout Readiness Check is a local Claude Desktop extension for electrical subcontractor project managers. It checks one selected folder against a fixed public-reference electrical closeout baseline and returns cited pre-submission findings for human review.

## Current state

The MVP source, automated tests, synthetic reference fixture, static website, and Vercel functions are implemented. The public download and paid activation remain unavailable until the dedicated Stripe configuration, custom domain, release package, and end-to-end billing proof are complete. The first authorized beta/customer folder is still required before marketplace launch because synthetic fixtures cannot prove real-world usefulness.

Run `npm ci` followed by `npm run check` for the build and 16-test local verification suite. Run `npm run pack` and `npm run package:check` to build and inspect the Claude Desktop package.

## Isolation boundary

This is not part of any other portfolio product. It must have its own source, public repository, Stripe account context, Vercel project, domain, signing namespace, local state directory, tests, package, and release evidence. Proven patterns may be copied, but no code, credential, data store, provider resource, or runtime is shared.

## Data boundary

The extension reads only the folder selected during installation. Project files remain on that computer; the hosted service receives only subscription and purpose-bound installation proof needed for activation, validation, recovery, or billing management. The product does not include OCR and does not certify contract completeness or acceptance.

## Privacy Policy

See https://closeoutcheck.m2ai.tech/privacy. Final legal text is an owner/attorney-review draft and must match the shipped data and billing behavior before release.
