# DevForge CLI

DevForge CLI is an AI-native scaffolding tool for JavaScript and TypeScript teams that want more than a blank starter. It turns project intent into a runnable repository with architecture guidance, starter surfaces, testing setup, AI rules, repository hygiene, and contributor docs already in place.

## Why DevForge Exists

Most new projects lose time before real product work even starts. Teams repeat the same setup decisions around frameworks, package managers, testing, linting, formatting, release hygiene, CI, and AI tooling. DevForge compresses that setup phase into one guided flow and outputs a repository that already explains itself.

DevForge helps you:

- move from idea to runnable repo faster
- avoid invalid stack combinations before they land in code
- start with project docs, starter surfaces, and contributor files on day one
- standardize scaffolding across personal projects, internal tooling, and client work
- keep Cursor, Claude, and Codex aligned with the selected stack through generated rules

## What It Generates

- landing pages, frontend apps, backend APIs, fullstack apps, microfrontend workspaces, Chrome extensions, and CLI tools
- project-detail starter UIs for frontend surfaces
- metadata and health endpoints for backend and fullstack APIs
- AI rule outputs for Cursor, Claude, Codex, and `AGENTS.md`
- testing setup for Vitest, Jest, Playwright, and Cypress
- optional ESLint, Prettier, Husky, Commitlint, Docker, and GitHub Actions setup
- deployment baselines for verified Vercel, Netlify, Render, Railway, and Docker Compose scaffold pairs
- generated docs, changelog-ready project metadata, and baseline repository hygiene

## Quick Start

Run without a global install:

```bash
npx --yes @ali-dev11/devforge@latest
```

Global install:

```bash
npm install -g @ali-dev11/devforge
devforge
```

Machine readiness check:

```bash
npx --yes @ali-dev11/devforge@latest doctor
```

Add managed features later:

```bash
npx --yes @ali-dev11/devforge@latest add testing
npx --yes @ali-dev11/devforge@latest add docker
```

Plan-only preflight:

```bash
npx --yes @ali-dev11/devforge@latest init --preflight-only
```

Config-driven scaffold:

```bash
npx --yes @ali-dev11/devforge@latest init --config ./devforge.config.json --output ./my-app
```

Built-in preset scaffold:

```bash
npx --yes @ali-dev11/devforge@latest init --preset frontend-app --output ./my-app
```

Refresh managed docs, workflows, and tooling:

```bash
npx --yes @ali-dev11/devforge@latest upgrade
```

## What The CLI Asks You

DevForge keeps core setup decisions required, and pushes the rest behind optional customization steps.

- Always asked: project name, output directory, Node strategy, package manager, project intent, architecture when there is more than one valid choice, and stack-specific core choices like framework or backend language.
- Asked only when you opt in to customization: frontend libraries, backend capabilities, testing details, AI rule details, linting/formatting/hooks, and extra DevOps tooling.

## Prompt Guide

Every prompt in DevForge exists to answer one of four questions: where the project should live, what kind of product is being created, which stack should power it, and how much team/process setup should be generated from day one.

- `Project name`: becomes the generated package or workspace name and is reused in starter screens, docs, and metadata.
- `Output directory`: tells DevForge where to write files. It is needed so the generator knows which folder to create or validate before writing.
- `Node.js version`: controls whether the scaffold follows the current LTS track, the latest available release, or a custom pinned version for stricter team environments.
- `Package manager`: chooses the lockfile, install command, and workspace behavior for the generated project.
- `What are you building?`: decides the entire downstream flow, including whether DevForge asks frontend, backend, extension, CLI, or workspace-specific questions.
- `Architecture style`: determines whether the output is a single app, a modular codebase, a monorepo, or a microfrontend workspace when that makes sense for the selected intent.
- `Template tier`: controls how much baseline setup and production-minded structure the scaffold should include.

The full prompt-by-prompt guide is here:

- [Prompt Reference](./docs/prompts.md)

## Default Versus Optional Tooling

- ESLint: enabled by default because most teams want lint feedback immediately.
- Prettier: enabled by default so formatting stays consistent across humans and AI tools.
- Husky: optional and off by default because local git hooks are team-policy dependent.
- Commitlint: optional and off by default unless you explicitly want commit-message enforcement.
- Docker and generated GitHub Actions: optional, depending on whether the project needs containerization or repo-level automation from day one.

## How DevForge Helps In Practice

- For frontend teams, it creates a visible starter surface that shows the selected stack, project metadata, and generator details.
- For backend teams, it exposes structured metadata and health endpoints so the scaffold is immediately inspectable.
- For fullstack teams, it gives you both a frontend shell and an API surface instead of only config files.
- For platform teams, it creates repeatable project conventions around docs, testing, and AI rules.
- For public packages and client work, it reduces “first week” setup drift and gives contributors a clearer starting point.

## Development Commands

```bash
npm install
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

## Why These Commands Matter

- `npm install` installs local development dependencies for the DevForge repository itself.
- `npm run lint` checks repository code quality rules.
- `npm run typecheck` validates the TypeScript source without emitting build output.
- `npm run test` runs regression coverage for prompts, normalization, generator output, changelog rendering, and runtime-matrix coverage.
- `npm run build` compiles the CLI into `dist/` so the published package and smoke runs use built artifacts.
- `npm run check` is the main contributor safety command because it combines linting, typechecking, tests, and build verification.
- `npm run docs:changelog` refreshes the GitHub Pages changelog page from `CHANGELOG.md`.
- `npm run smoke` verifies a non-interactive scaffold run end to end.
- `npm run smoke:packed` packs the actual npm tarball, installs it into a temp directory, and verifies the published artifact shape instead of only the source checkout.
- `npm run runtime:matrix -- --scenario ...` installs, builds, and verifies generated projects so the scaffold output is tested as a product, not just as source code.

## Config As Code

- `devforge init --save-config` saves the resolved scaffold plan as `devforge.config.json` in the generated project by default.
- `devforge init --save-config ./configs/web.json` saves the normalized plan to a custom location.
- `devforge init --config ./devforge.config.json --output ./my-app` replays a saved scaffold non-interactively.
- `devforge init --preset frontend-app` seeds the flow with a built-in preset, and `--preset ./preset.json` lets teams keep reusable local preset files under version control.
- `--output` and `--name` can still override the saved config at runtime, so the same config file stays reusable across multiple projects.

## Add Features Later

- `devforge add testing` enables the scaffold's recommended test runner for the saved stack and writes the matching test config and starter tests.
- `devforge add docker` adds the generated `Dockerfile` and `.dockerignore` for the current DevForge project.
- `devforge add github-actions` adds the generated CI workflow for the current project stack.
- `devforge add ai-rules` restores `AGENTS.md`, `.cursor`, `.claude`, and the AI rule source docs when those were skipped initially.
- `devforge add` works only inside DevForge-generated projects because it reads `.devforge/project-plan.json` to update managed files safely.

## Upgrade Managed Surfaces

- `devforge upgrade` refreshes DevForge-managed docs, workflows, AI rule files, deployment baselines, and core tooling files from the saved `.devforge/project-plan.json`.
- Upgrade is intentionally conservative: if a managed file no longer matches the previous generated baseline, DevForge skips it instead of overwriting local edits.
- New generated docs and workflows now carry a DevForge managed marker so plan-driven upgrades can safely refresh those files later.

## Deployment Targets

- Verified deployment targets are offered only for supported stack pairs.
- `react-vite` frontend apps can target `Vercel`, `Netlify`, or `Render`.
- `nextjs` frontend apps can target `Vercel`, `Render`, or `Railway`.
- `express`, `fastify`, and `hono` backend APIs can target `Docker Compose`, `Render`, or `Railway`.
- Deployment generation includes provider-specific config files, build/start/health-path guidance, expected env vars, and optional manual deploy workflows when GitHub Actions are enabled.

## Repository Docs

- [Documentation Site](https://ali-dev11.github.io/devforge/)
- [Docs Home](./docs/index.md)
- [Prompt Reference](./docs/prompts.md)
- [Overview](./docs/overview.md)
- [Architecture](./docs/architecture.md)
- [Development](./docs/development.md)
- [Generated Output](./docs/generated-output.md)
- [Changelog](./CHANGELOG.md)
- [GitHub Releases](https://github.com/Ali-dev11/devforge/releases)
- [GitHub Pages Changelog](https://ali-dev11.github.io/devforge/changelog.html)

## Community Health

- [Contributing Guide](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)
- [Bug Report Template](./.github/ISSUE_TEMPLATE/bug-report.yml)
- [Feature Request Template](./.github/ISSUE_TEMPLATE/feature-request.yml)
- [Documentation Request Template](./.github/ISSUE_TEMPLATE/documentation.yml)
- [Pull Request Template](./.github/pull_request_template.md)

## Repository Structure

- `src/cli.ts` handles argument parsing and command dispatch.
- `src/commands/init.ts` orchestrates the interactive initialization flow.
- `src/engines/` contains environment detection, prompting, normalization, generation, installation, and AI rule logic.
- `src/templates.ts` defines generated project files, starter surfaces, and generated docs.
- `src/runtime-matrix.ts` verifies generated project installs, builds, and runtime behavior.
- `src/devforge-rules.ts` maps stack choices to DevForge-curated AI rule packs.
- `docs/` powers the public documentation site.
- `test/` covers generator behavior, decision normalization, changelog rendering, and runtime-matrix coverage.

## License

[MIT](./LICENSE)
