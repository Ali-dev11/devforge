---
title: Architecture
---

# Architecture

DevForge is split into focused layers instead of one large command module.

## Layers

### CLI Surface

- `src/bin/`: executable entrypoints
- `src/cli.ts`: argument parsing, help/version behavior, command dispatch

### Command Layer

- `src/commands/init.ts`: orchestrates the `init` workflow

### Engines

- `environment.ts`: inspects Node and package manager availability
- `prompts.ts`: collects and defaults user choices
- `decision.ts`: normalizes incompatible combinations
- `generator.ts`: writes the scaffold and project plan
- `installer.ts`: installs dependencies and initializes git
- `ai-rules.ts`: writes AI rule files and rule-source docs

### Output Templates

- `src/templates.ts`: generates package files, docs, testing setup, tooling files, and starter code
- `src/devforge-rules.ts`: maps stack choices to DevForge-curated rule pack recommendations

## Design Principles

- keep user-facing commands thin
- make normalization explicit before generation
- generate docs as part of the scaffold
- keep logic testable and modular
