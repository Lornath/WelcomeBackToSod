# Welcome (Back) to SoD

Static guide site for World of Warcraft Classic: Season of Discovery, hosted at
[welcomebacktosod.com](https://welcomebacktosod.com).

The site is a single page (`src/index.html` + `src/app.js` + `src/styles.css`)
plus a couple of media assets. There is no build step — the files in `src/` are
exactly what gets served.

## Layout

```
src/                     # the site itself; deployed as-is
scripts/check-links.mjs  # custom checker (TOC↔section + external-link attrs)
infra/                   # Terraform: S3 + CloudFront + ACM + Route 53 + GitHub OIDC role
.github/workflows/       # lint.yml + deploy.yml
package.json             # devDeps only: html-validate, eslint
```

## Local development

```sh
cd src
python -m http.server 8000
# open http://localhost:8000
```

That's it — no build step, no Node required for runtime.

## Linting (optional, local)

```sh
npm ci
npm run lint
```

Runs three checks:

- `lint:html` — `html-validate` over `src/**/*.html`
- `lint:js` — `eslint` over `src/` and `scripts/`
- `lint:links` — custom `scripts/check-links.mjs`, which enforces:
  1. every TOC `<a href="#X">` resolves to an element with `id="X"`
  2. every `<section id>`, `<h2 id>`, and `<h3 id>` is referenced from the
     sidebar TOC (h4 ids are unchecked — use them for inline anchors)
  3. every external `<a href="http(s)://…">` has `target="_blank"` and
     `rel` containing `noopener`

These same checks run in CI on every push and pull request.

## Editing tips

When you add a section or heading to `src/index.html`:

- For a new `<h2>` or `<h3>` with an `id`, add a matching entry in the TOC
  `<aside class="sidebar">` so the checker doesn't complain.
- Any new external `<a>` needs `target="_blank"` and `rel="noopener noreferrer"`.

## Deployment

Pushes to `main` deploy automatically via `.github/workflows/deploy.yml`:

1. GitHub Actions assumes an AWS IAM role via OIDC (no long-lived keys).
2. `aws s3 sync src/ s3://<bucket>` uploads the site (HTML is `no-cache`, the
   rest is cached for one day).
3. `aws cloudfront create-invalidation --paths "/*"` flushes the edge cache.

To deploy: just `git push origin main` and watch the Actions tab.

## One-time AWS bootstrap

The first apply is manual. After this, GitHub Actions handles deploys.

You need `awscli` and `terraform` installed, plus AWS credentials configured
for an account with admin rights (`aws configure --profile …` or env vars).

```sh
cd infra
terraform init
terraform apply
```

Terraform will:

- create the S3 bucket, CloudFront distribution, ACM cert (in `us-east-1`),
  Route 53 hosted zone, and GitHub OIDC role
- output four values you'll need next: `nameservers`, `s3_bucket_name`,
  `cloudfront_distribution_id`, `deploy_role_arn`, `aws_region`

The first `apply` may pause at ACM validation until the domain is delegated:

1. Copy the four `nameservers` values from the Terraform output.
2. At Squarespace → Domains → `welcomebacktosod.com` → DNS Settings → Custom
   Nameservers, paste them in (replacing the defaults). This is a one-time
   change; the registrar stays at Squarespace.
3. Wait for propagation (usually a few minutes; up to an hour). Re-run
   `terraform apply` if it timed out — it will pick up where it left off.

Once apply completes, set these four GitHub Actions **variables** (not
secrets) in repo Settings → Secrets and variables → Actions → Variables:

| Variable                | Value                                       |
| ----------------------- | ------------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN`   | from `terraform output deploy_role_arn`     |
| `AWS_REGION`            | from `terraform output aws_region`          |
| `S3_BUCKET`             | from `terraform output s3_bucket_name`      |
| `CF_DISTRIBUTION_ID`    | from `terraform output cloudfront_distribution_id` |

Push a commit to `main` to trigger the first deploy.

## Terraform state

The state file (`infra/terraform.tfstate`) lives locally and is gitignored.
That's fine for a single-operator static site. To move to a remote backend
later, add an `s3` backend block to `infra/versions.tf`, then
`terraform init -migrate-state`.

## Verifying the live site

```sh
dig +short NS welcomebacktosod.com         # should be AWS nameservers
curl -I https://welcomebacktosod.com       # 200 with valid cert
curl -I https://www.welcomebacktosod.com   # 200 with valid cert
```
