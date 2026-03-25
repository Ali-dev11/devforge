# DevForge CLI

DevForge CLI is a production-focused, AI-native scaffolding tool for modern JavaScript and TypeScript applications. It helps teams move from project intent to a documented, installable repository with architecture guidance, AI assistant rules, testing setup, release hygiene, and baseline tooling already in place.

## Why DevForge

Starting a new project usually means repeating the same setup work: choosing frameworks, wiring testing, adding linting, deciding on architecture, documenting the stack, and aligning AI assistants with team standards. DevForge turns that setup phase into a guided flow that produces a repo your team can actually build on.

DevForge helps you:

- reduce setup time for frontend, backend, fullstack, microfrontend, extension, and CLI projects
- avoid invalid stack combinations through built-in normalization and compatibility rules
- start with generated docs, health surfaces, project metadata, and repository hygiene from day one
- configure AI tools like Cursor, Claude, and Codex with stack-aware rule packs
- standardize project creation across teams, internal tools, client work, and experiments

## What You Get

- intent-driven scaffolding for landing pages, frontend apps, backend APIs, fullstack apps, microfrontends, Chrome extensions, and CLI tools
- environment-aware setup for Node.js and package manager selection
- configurable ESLint, Prettier, and Husky strictness profiles
- testing setup prompts for Vitest, Jest, Playwright, Cypress, `node`, `jsdom`, and `happy-dom`
- frontend state and data choices including Redux Toolkit, MobX, Jotai, TanStack Query, RTK Query, and more
- generated docs, AI rules, CI, contribution files, and release-ready repository hygiene

## Generated Starter Experience

DevForge does not stop at writing config files. Fresh projects include meaningful starter surfaces so the generated app explains itself:

- frontend projects render a project details page with stack information and generator metadata
- backend projects expose structured metadata from `/` and `/health`
- fullstack apps ship with a frontend surface and an API health route
- microfrontends generate a host plus remotes with role-aware starter screens
- Chrome extensions include popup, background, and content-script starter surfaces
- CLI projects expose human-readable output and machine-readable `--json` output

## Quick Start

Run without installing globally:

```bash
npx @ali-dev11/devforge@latest
```

Global install:

```bash
npm install -g @ali-dev11/devforge
create-devforge
# or
devforge
```

## Local Development

```bash
npm install
npm run check
npm run build
node dist/bin/devforge.js --help
node dist/bin/devforge.js init
```

## Release History And Docs

- [Documentation Site](https://ali-dev11.github.io/devforge/)
- [Docs Overview](./docs/overview.md)
- [Changelog](./CHANGELOG.md)
- [GitHub Releases](https://github.com/Ali-dev11/devforge/releases)
- [GitHub Pages Changelog](https://ali-dev11.github.io/devforge/changelog.html)

## Development Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run check
npm run docs:changelog
npm run smoke
npm run runtime:matrix -- --scenario backend-hono --scenario cli-tool
```

## Documentation

- [Docs Home](./docs/index.md)
- [Changelog Page](./docs/changelog.md)
- [Overview](./docs/overview.md)
- [Architecture](./docs/architecture.md)
- [Development](./docs/development.md)
- [Generated Output](./docs/generated-output.md)
- [Contributing](./CONTRIBUTING.md)
- [Docs Contributing Page](./docs/contributing.md)

## Community Health

- [Contributing Guide](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)
- [Bug Report Template](./.github/ISSUE_TEMPLATE/bug-report.yml)
- [Feature Request Template](./.github/ISSUE_TEMPLATE/feature-request.yml)
- [Documentation Request Template](./.github/ISSUE_TEMPLATE/documentation.yml)
- [Pull Request Template](./.github/pull_request_template.md)

## Repository Structure

- `src/cli.ts`: argument parsing and command dispatch
- `src/commands/init.ts`: orchestration for the init flow
- `src/engines/`: environment detection, prompts, normalization, generation, install hooks, AI rules
- `src/templates.ts`: generated file content and project docs
- `src/devforge-rules.ts`: DevForge-curated AI rule pack mapping
- `test/`: regression tests
- `docs/`: product, architecture, and contribution documentation

## License

[MIT](./LICENSE)
