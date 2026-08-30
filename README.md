# Closeout Readiness Check

Closeout Readiness Check is a local Claude Desktop extension for electrical subcontractor project managers. It checks one selected folder against a fixed public-reference electrical closeout baseline and returns cited pre-submission findings for human review.

## Current state

The source, automated tests, synthetic reference fixture, website, custom domain, dedicated Stripe sandbox, and Vercel runtime are implemented. The current public package is an explicit technical beta: it uses Stripe test mode, processes no real charges, and exists for installation and end-to-end review. Live billing and Anthropic directory submission remain closed until Stripe business verification, owner or attorney review of the legal drafts, and the first authorized beta/customer folder prove the rules are useful on real closeout material.

Run `npm ci` followed by `npm run check` for the build and local verification suite. Run `npm run pack` and `npm run package:check` to build and inspect the Claude Desktop package. The website opens checkout only from the purchasing computer's activation link; billing-portal return visits lead to the billing guide.

## Isolation boundary

This is not part of any other portfolio product. It must have its own source, public repository, Stripe account context, Vercel project, domain, signing namespace, local state directory, tests, package, and release evidence. Proven patterns may be copied, but no code, credential, data store, provider resource, or runtime is shared.

## Data boundary

The extension reads only the folder selected during installation. Project files remain on that computer; the hosted service receives only subscription and purpose-bound installation proof needed for activation, validation, recovery, or billing management. The product does not include OCR and does not certify contract completeness or acceptance.

## Privacy Policy

See https://closeoutcheck.m2ai.tech/privacy. Final legal text is an owner/attorney-review draft and must match the shipped data and billing behavior before live billing or directory submission.
