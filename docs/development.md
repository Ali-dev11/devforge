---
title: Development
---

# Development

## Prerequisites

- Node.js 20+
- npm 10+ recommended

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
```

## Workflow

1. Make changes in `src/`.
2. Run `npm run check`.
3. Use `npm run smoke` for an end-to-end non-interactive scaffold.
4. Update docs when command behavior or generated output changes.
