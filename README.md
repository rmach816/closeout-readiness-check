# Closeout Readiness Check

Closeout Readiness Check is a local Claude Desktop extension for electrical subcontractor project managers. It checks one selected folder against a fixed public-reference electrical closeout baseline and returns cited pre-submission findings for human review.

## Current state

The source, automated tests, synthetic reference fixture, website, custom domain, dedicated Stripe sandbox, and Vercel runtime are implemented. The current public package is an explicit technical beta: it uses Stripe test mode, processes no real charges, and exists for installation and end-to-end review. Live billing requires completed Stripe verification and separate live-mode proof. The policies have received owner-authorized AI review and have been corrected to match the data flow. Real-project validation is the first private-beta milestone; synthetic engineering proof is not real-customer accuracy evidence. Directory submission and acceptance are separate from release availability.

Run `npm ci` followed by `npm run check` for the build and local verification suite. Run `npm run pack` and `npm run package:check` to build and inspect the Claude Desktop package. The website opens checkout only from the purchasing computer's activation link; billing-portal return visits lead to the billing guide.

## Isolation boundary

This is not part of any other portfolio product. It must have its own source, public repository, Stripe account context, Vercel project, domain, signing namespace, local state directory, tests, package, and release evidence. Proven patterns may be copied, but no code, credential, data store, provider resource, or runtime is shared.

## Data boundary

The extension reads only the folder selected during installation. Files are scanned locally. Findings, cited paths, and short excerpts are returned to Claude and may be processed by Anthropic under the user's Claude account terms and settings. M2 AI's hosted billing service does not receive project documents or report excerpts; it receives activation identifiers and public keys, selected plans, and subscription proofs or recovery authorization. Use only documents you are authorized to review and share with Claude. The product does not include OCR and does not certify contract completeness or acceptance.

## Privacy Policy

See https://closeoutcheck.m2ai.tech/privacy. It describes local scanning, report details returned to Claude, hosted activation and billing information, support email processing, retention, and contact options.
