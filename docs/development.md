---
title: Development
---

# Development

## Prerequisites

- Node.js 20+
- npm 10+ recommended
- Use Node `20.19.0+` or `22.12.0+` when running generated frontend or extension runtime scenarios locally.

## Local Setup

```bash
npm install
npm run check
```

## Common Commands

```bash
npm run dev -- --help
npm run build
npm run test
npm run lint
npm run smoke
npm run runtime:matrix -- --scenario backend-hono --scenario cli-tool
```

## Workflow

1. Make changes in `src/`.
2. Run `npm run check`.
3. Use `npm run smoke` for an end-to-end non-interactive scaffold.
4. Use `npm run runtime:matrix` to verify generated installs, builds, and runtime surfaces for representative stacks.
5. Update docs when command behavior or generated output changes.
