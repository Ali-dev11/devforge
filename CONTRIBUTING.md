# Contributing

## Setup

```bash
npm install
npm run check
```

## Expectations

- Keep changes aligned with the current architecture split between CLI, engines, and templates.
- Add or update tests when normalization, setup, or generation behavior changes.
- Update documentation when flags, generated files, or workflows change.
- Use the issue templates when reporting bugs, feature requests, or documentation gaps.
- Keep pull requests focused, documented, and small enough to review comfortably.

## Workflow

1. Create or confirm an issue before starting larger work.
2. Branch from the latest default branch.
3. Make the smallest complete change that solves the issue.
4. Run `npm run check`.
5. Open a pull request with the provided PR template.

## Before Opening a PR

```bash
npm run check
npm run smoke
npm run docs:changelog
npm run runtime:matrix -- --scenario backend-hono --scenario cli-tool
```

For generated frontend, extension, and fullstack runtime scenarios, use Node `20.19.0+` or `22.12.0+` so the current Vite-family toolchain can install and build cleanly.

## Pull Request Expectations

- explain what changed and why
- link the related issue
- call out breaking changes or follow-up work
- include screenshots or terminal output when behavior changed visibly

## Commit Guidance

- use clear, descriptive commits
- keep unrelated refactors out of the same pull request
- update docs when public behavior or setup changes

## Versioning And Releases

- This project uses Semantic Versioning.
- Use a patch release for bug fixes and release-process improvements that do not change the public contract.
- Use a minor release for backward-compatible CLI capabilities, templates, or generated output improvements.
- Use a major release for breaking CLI, prompt, config, or generated-project changes.
- Add release notes to `CHANGELOG.md` before publishing.
- Regenerate `docs/changelog.md` with `npm run docs:changelog` whenever `CHANGELOG.md` changes.
- Use `npm run release:patch`, `npm run release:minor`, or `npm run release:major` to bump versions.
- The version commands run `npm run release:check` first so lint, typecheck, tests, build, and pack validation all pass before the version changes.
- Push a semantic version tag like `v0.3.3` to trigger the GitHub Release workflow after the changelog and package version are in sync.

## Communication

- be respectful and constructive
- assume good intent
- prefer actionable feedback over vague criticism

## Scope Guidance

- Put cross-stack compatibility logic in `src/engines/decision.ts`.
- Put generated file content in `src/templates.ts`.
- Keep `src/commands/init.ts` focused on orchestration, not business logic.
