---
title: Development
---

# Development

## Prerequisites

- Node.js 20+
- npm 10+ recommended for working on the DevForge repository
- Use Node `20.19.0+` or `22.12.0+` when running generated frontend or extension runtime scenarios locally

## Local Setup

```bash
npm install
npm run check
```

## Repository Commands

```bash
npm run dev -- --help
npm run lint
npm run typecheck
npm run test
npm run build
npm run check
npm run docs:changelog
npm run smoke
npm run runtime:matrix -- --scenario backend-hono --scenario cli-tool
```

## Why Each Command Exists

- `npm run dev -- --help` lets you exercise the CLI locally without publishing a package first.
- `npm run lint` checks repository code-style and code-quality rules.
- `npm run typecheck` catches TypeScript regressions before runtime.
- `npm run test` runs focused regression tests for prompting, normalization, generator output, changelog rendering, and runtime-matrix coverage.
- `npm run build` compiles the CLI to `dist/`, which mirrors what npm users receive.
- `npm run check` is the primary contributor gate because it runs lint, types, tests, and build verification together.
- `npm run docs:changelog` keeps the GitHub Pages changelog synchronized with `CHANGELOG.md`.
- `npm run smoke` verifies a fast end-to-end scaffold run without interactive prompts.
- `npm run runtime:matrix -- --scenario ...` validates generated projects as products by installing, building, and checking runtime behavior for representative stacks.

## Working On Generated Scaffolds

- Prefer `npm run smoke` for quick CLI sanity checks.
- Use `npm run runtime:matrix` when changing templates, prompts, package-manager behavior, or generated runtime surfaces.
- If you touch microfrontend templates, validate the generated `dev` workflow, not just build output.
- If you touch docs or release notes, rerun `npm run docs:changelog`.

## Tooling Defaults

- ESLint and Prettier are default-on in generated projects because they are broad quality baselines.
- Husky and Commitlint are opt-in because local hook enforcement is not appropriate for every team or prototype.
- Generated GitHub Actions, Docker, and heavier DevOps setup remain optional to avoid forcing unnecessary tooling into every scaffold.
