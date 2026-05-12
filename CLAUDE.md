# Notes for Claude

Static site, no build step. The files in `src/` are served as-authored.

## Local dev

`cd src && python -m http.server 8000` — that's the whole local workflow. No
Node needed for runtime; only for lint.

## Linting

`npm run lint` runs three checks. CI runs the same three on every push/PR:

- `html-validate` over `src/**/*.html`
- `eslint` over `src/` and `scripts/` (flat config in `eslint.config.mjs`)
- `scripts/check-links.mjs` — custom checker

The custom checker enforces three invariants:

1. Every TOC `<a href="#X">` (inside the `<aside class="sidebar">`) resolves
   to an element with `id="X"` somewhere in `src/index.html`.
2. Every `<section id>`, `<h2 id>`, and `<h3 id>` is referenced by the
   sidebar TOC. (`<h4 id>` and below are treated as intra-page anchor targets
   and not enforced — use those for inline `#foo` links inside body copy.)
3. Every external `<a href="http(s)://…">` (not pointing at
   `welcomebacktosod.com`) has `target="_blank"` and `rel` containing
   `noopener`.

When editing `src/index.html`:

- New `<h2>` or `<h3>` with an id → add a matching entry to the sidebar TOC.
- New external `<a>` → add `target="_blank" rel="noopener noreferrer"`.

CI will fail otherwise.

## Source style

- `src/app.js` is an IIFE in `script` (non-module) source type. Don't convert
  it to a module — the page loads it with a plain `<script src>`.
- No frameworks, no bundler, no transpiler. Don't introduce one without
  asking. The whole point of this setup is that the files in `src/` are
  exactly what ships.

## Infra

Terraform in `infra/` — one prod environment. Resources:

- S3 (private, OAC) + CloudFront (TLS 1.2, redirect-to-HTTPS)
- ACM cert in `us-east-1` (CloudFront requirement), DNS-validated via Route 53
- Route 53 hosted zone (Squarespace registrar delegates NS records to it)
- GitHub OIDC provider + deploy role, scoped to
  `repo:Lornath/WelcomeBackToSod:ref:refs/heads/main`

State is local (`infra/terraform.tfstate`), gitignored. Don't commit it.

## Deploy flow

Push to `main` triggers `.github/workflows/deploy.yml`:

1. OIDC into the deploy role
2. `aws s3 sync src/ s3://<bucket>` (HTML no-cache, rest 1-day)
3. `aws cloudfront create-invalidation --paths "/*"`

No long-lived AWS credentials anywhere. The four config values
(`AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `S3_BUCKET`, `CF_DISTRIBUTION_ID`) are
GitHub Actions **variables** (not secrets) — they're not sensitive.

## Things not to do

- Don't add a build step or framework.
- Don't convert `src/app.js` to ES modules.
- Don't move the deploy-role variables into Secrets — they're not secret.
- Don't commit `terraform.tfstate` or `.tfvars`.
