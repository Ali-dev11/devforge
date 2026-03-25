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
```

## Pull Request Expectations

- explain what changed and why
- link the related issue
- call out breaking changes or follow-up work
- include screenshots or terminal output when behavior changed visibly

## Commit Guidance

- use clear, descriptive commits
- keep unrelated refactors out of the same pull request
- update docs when public behavior or setup changes

## Communication

- be respectful and constructive
- assume good intent
- prefer actionable feedback over vague criticism

## Scope Guidance

- Put cross-stack compatibility logic in `src/engines/decision.ts`.
- Put generated file content in `src/templates.ts`.
- Keep `src/commands/init.ts` focused on orchestration, not business logic.
