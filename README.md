# Welcome (Back) to SoD

Static guide site for World of Warcraft Classic: Season of Discovery, hosted at
[welcomebacktosod.com](https://welcomebacktosod.com).

The site is a single page (`src/index.html` + `src/app.js` + `src/styles.css`)
plus a couple of media assets. There is no build step - the files in `src/` are
exactly what gets served and can be hosted locally for development.

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

