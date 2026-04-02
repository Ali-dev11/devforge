---
title: DevForge CLI Docs
---

# DevForge CLI Docs

DevForge CLI turns project intent into a runnable JavaScript or TypeScript repository with architecture guidance, testing setup, starter surfaces, AI rules, and baseline repository hygiene already in place.

## Start Here

- [Overview](./overview.md)
- [Prompt Reference](./prompts.md)
- [Architecture](./architecture.md)
- [Generated Output](./generated-output.md)
- [Development](./development.md)
- [Contributing](./contributing.md)
- [Changelog](./changelog.md)

## Why Teams Use DevForge

- to avoid rebuilding the same repo setup on every new project
- to catch incompatible stack decisions before code is generated
- to start with docs, starter screens, API metadata, and contributor files on day one
- to standardize AI tooling and rules across projects
- to keep scaffolding quality high through generated runtime verification

## Defaults And Optional Choices

- ESLint and Prettier are baseline defaults because most teams want immediate quality and formatting consistency.
- Husky and Commitlint are optional because local git-hook enforcement varies by team and workflow.
- Testing, AI rules, backend capabilities, frontend libraries, and DevOps extras can all stay on recommended defaults or be customized only when needed.
- Deployment targets are limited to verified stack pairs so DevForge only offers deployment baselines it can actually generate and validate.

## Command Reference

- `npx --yes @ali-dev11/devforge@latest`: run DevForge without a global install.
- `npx --yes @ali-dev11/devforge@latest doctor`: inspect local machine readiness before generating a scaffold.
- `npx --yes @ali-dev11/devforge@latest init --preflight-only`: run stack-aware checks for the chosen plan without writing files yet.
- `npx --yes @ali-dev11/devforge@latest init --preset frontend-app`: start from a built-in preset or pass a local preset file path.
- `npx --yes @ali-dev11/devforge@latest init --save-config`: save the resolved scaffold plan as `devforge.config.json` for reuse.
- `npx --yes @ali-dev11/devforge@latest init --config ./devforge.config.json --output ./my-app`: regenerate a saved scaffold non-interactively in a new location.
- `npx --yes @ali-dev11/devforge@latest add testing`: add the recommended managed testing setup to an existing DevForge project.
- `npx --yes @ali-dev11/devforge@latest add docker`: add the generated Docker assets to an existing DevForge project.
- `npx --yes @ali-dev11/devforge@latest add github-actions`: add the generated CI workflow to an existing DevForge project.
- `npx --yes @ali-dev11/devforge@latest add ai-rules`: add the managed AI rule files back into an existing DevForge project.
- `npx --yes @ali-dev11/devforge@latest upgrade`: refresh DevForge-managed docs, workflows, AI rules, deployment files, and core tooling surfaces from `.devforge/project-plan.json`.
- `Project prompts`: use the [Prompt Reference](./prompts.md) when you want to know what a question changes before answering it.
- `npm run check`: validate the DevForge repository itself before pushing changes.
- `npm run smoke`: verify a non-interactive scaffold path.
- `npm run smoke:packed`: validate the built npm tarball instead of only the source tree.
- `npm run runtime:matrix -- --scenario ...`: validate generated installs, builds, and runtime behavior for representative stacks.
- `npm run docs:changelog`: refresh the GitHub Pages changelog page from the main changelog file.

## Project Links

- [Repository README](https://github.com/Ali-dev11/devforge#readme)
- [GitHub Releases](https://github.com/Ali-dev11/devforge/releases)
- [Contributing Guide](https://github.com/Ali-dev11/devforge/blob/main/CONTRIBUTING.md)
- [Code of Conduct](https://github.com/Ali-dev11/devforge/blob/main/CODE_OF_CONDUCT.md)
- [Security Policy](https://github.com/Ali-dev11/devforge/blob/main/SECURITY.md)
