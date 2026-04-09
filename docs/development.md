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
npx --yes @ali-dev11/devforge@latest doctor
```

## Config-As-Code Workflow

```bash
npx --yes @ali-dev11/devforge@latest init --preset frontend-app --output ./my-app
npx --yes @ali-dev11/devforge@latest init --yes --save-config
npx --yes @ali-dev11/devforge@latest init --config ./devforge.config.json --output ./my-app
npx --yes @ali-dev11/devforge@latest upgrade
npx --yes @ali-dev11/devforge@latest add testing
```

- `--preset` seeds the scaffold from a built-in preset name or a local preset JSON file so teams can standardize starting points.
- `--save-config` writes the normalized project plan to `devforge.config.json` so the same scaffold can be replayed later.
- `--config` runs the generator non-interactively from a saved plan while still letting `--output` or `--name` override the destination.
- Config-driven runs pass through the same normalization and compatibility checks as interactive runs, so invalid hand-written combinations are still corrected or rejected with guidance.
- `devforge upgrade` refreshes DevForge-managed docs, workflows, AI rules, deployment files, and core tooling surfaces while skipping files that no longer match the previous generated baseline.
- `devforge add <feature>` updates an existing DevForge project by reading `.devforge/project-plan.json` and rewriting only the managed files for that feature.
- Verified deployment targets now carry a normalized provider profile, so generated docs and workflows stay aligned on build commands, start commands, health checks, secrets, and expected environment variables.

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
npm run smoke:packed
npm run runtime:matrix -- --scenario backend-hono --scenario cli-tool
```

## Why Each Command Exists

- `npm run dev -- --help` lets you exercise the CLI locally without publishing a package first.
- `npm run lint` checks repository code-style and code-quality rules.
- `npm run typecheck` catches TypeScript regressions before runtime.
- `npm run test` runs focused regression tests for prompting, normalization, generator output, changelog rendering, and runtime-matrix coverage.
- `npm run build` compiles the CLI to `dist/`, which mirrors what npm users receive.
- `npm run check` is the primary contributor gate because it runs lint, types, tests, and build verification together.
- `npx --yes @ali-dev11/devforge@latest doctor` checks the local machine for the tool and runtime prerequisites that commonly break first-run scaffolds.
- `npm run docs:changelog` keeps the GitHub Pages changelog synchronized with `CHANGELOG.md`.
- `npm run smoke` verifies a fast end-to-end scaffold run without interactive prompts.
- `npm run smoke:packed` verifies the built npm tarball by installing the packed artifact into a temp directory and running the shipped CLI from there.
- `npm run runtime:matrix -- --scenario ...` validates generated projects as products by installing, building, and checking runtime behavior for representative stacks.

## Working On Generated Scaffolds

- Prefer `npm run smoke` for quick CLI sanity checks.
- Run `npx --yes @ali-dev11/devforge@latest init --preflight-only` when you want stack-aware readiness checks without writing a new project yet.
- Use `npx --yes @ali-dev11/devforge@latest init --preset frontend-app` when validating built-in preset coverage or a local preset file path.
- Use `npx --yes @ali-dev11/devforge@latest init --save-config` when you want an interactive run to become a reusable team preset later.
- Use `npx --yes @ali-dev11/devforge@latest init --config ./devforge.config.json --output ./my-app` when validating reproducible scaffold output.
- Use `npx --yes @ali-dev11/devforge@latest upgrade` when changing generated docs, workflows, deployment baselines, or other managed tooling surfaces.
- When changing deployment targets, verify both the generated provider file and the follow-up workflow guidance because `upgrade` now removes stale managed provider files that still match a previous generated baseline.
- Use `npx --yes @ali-dev11/devforge@latest add testing`, `add docker`, `add github-actions`, or `add ai-rules` when validating managed post-scaffold updates.
- Use `npm run runtime:matrix` when changing templates, prompts, package-manager behavior, or generated runtime surfaces.
- Use `npm run smoke:packed` when changing the package entrypoints, published files, CLI dispatch, or install-time behavior.
- If you touch deployment generation, validate `Render` and `Railway` flows through `npm run runtime:matrix` or `npm run smoke:packed`, not just unit-level file snapshots.
- If you touch microfrontend templates, validate the generated `dev` workflow, not just build output.
- If you touch docs or release notes, rerun `npm run docs:changelog`.

## Tooling Defaults

- ESLint and Prettier are default-on in generated projects because they are broad quality baselines.
- Husky and Commitlint are opt-in because local hook enforcement is not appropriate for every team or prototype.
- Generated GitHub Actions, Docker, and heavier DevOps setup remain optional to avoid forcing unnecessary tooling into every scaffold.
