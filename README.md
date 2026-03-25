# DevForge CLI

DevForge CLI is a production-focused, AI-native scaffolding tool for modern JavaScript and TypeScript applications. It helps teams move from project intent to a documented, installable repository with architecture guidance, AI assistant rules, testing setup, and baseline tooling already in place.

## Highlights

- intent-driven project scaffolding for frontend, backend, fullstack, extension, microfrontend, and CLI projects
- environment-aware setup for Node.js and package manager selection
- configurable ESLint, Prettier, and Husky strictness profiles
- testing setup prompts for Vitest, Jest, Playwright, Cypress, `node`, `jsdom`, and `happy-dom`
- frontend state/data choices including Redux, Redux Toolkit, MobX, Jotai, TanStack Query, RTK Query, and more
- generated docs, AI rules, CI, and repo hygiene out of the box

## Quick Start

```bash
npm install
npm run check
npm run build
node dist/bin/devforge.js --help
node dist/bin/devforge.js init
```

## Development Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run check
npm run smoke
```

## GitHub Pages Docs

GitHub Pages setup guide: [docs/github-pages.md](./docs/github-pages.md)

This repository includes a Pages-ready `docs/` directory, a docs index page, Jekyll config, and a deployment workflow so the documentation site can publish cleanly from the repository.

## Documentation

- [Docs Home](./docs/index.md)
- [Overview](./docs/overview.md)
- [Architecture](./docs/architecture.md)
- [Development](./docs/development.md)
- [Generated Output](./docs/generated-output.md)
- [GitHub Pages Setup](./docs/github-pages.md)
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
- `docs/`: product, architecture, Pages, and contribution documentation

## License

[MIT](./LICENSE)

## Repository Metadata

This repository is configured for:

- GitHub owner: `Ali-dev11`
- repository URL: `https://github.com/Ali-dev11/devforge`
- GitHub Pages URL: `https://ali-dev11.github.io/devforge/`

If you use a different repository name later, update the URLs in `package.json` and `docs/github-pages.md`.
