---
title: GitHub Pages Setup
---

# GitHub Pages Setup

This repository is configured to publish the documentation site for `Ali-dev11/devforge` with GitHub Pages.

## Expected Site URL

- Repository: `https://github.com/Ali-dev11/devforge`
- Pages site: `https://ali-dev11.github.io/devforge/`

## What Is Already Included

- a `docs/` site source directory
- Jekyll configuration in `docs/_config.yml`
- a Pages deployment workflow in `.github/workflows/pages.yml`

## GitHub Repository Settings

In the GitHub repository:

1. Open `Settings`.
2. Open `Pages`.
3. Set the source to `GitHub Actions`.

After that, pushes to `main` can publish the docs site through the existing workflow.

## Local Docs Content

Update the markdown files in `docs/` when product behavior or contributor guidance changes:

- `docs/index.md`
- `docs/overview.md`
- `docs/architecture.md`
- `docs/development.md`
- `docs/generated-output.md`
- `docs/contributing.md`

## Troubleshooting

- If the site URL changes, update `package.json` and this page.
- If Pages does not deploy, check the `Deploy Docs` workflow in the Actions tab.
