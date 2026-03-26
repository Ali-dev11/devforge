---
title: Overview
---

# DevForge Overview

DevForge CLI is built for teams that want new projects to start with better defaults than “pick a framework and figure out the rest later.”

Instead of only generating folders and config files, DevForge helps you choose a compatible stack, captures those decisions in generated docs, and gives each scaffold a meaningful starter surface so the output is easier to inspect, review, and extend.

## What DevForge Solves

- repeated setup work across frontend, backend, fullstack, extension, CLI, and microfrontend projects
- broken starter repositories caused by incompatible framework, testing, or architecture choices
- drift between project code, contributor docs, and AI assistant expectations
- weak first-run experience where generated projects do not explain what was created

## How The Flow Works

1. DevForge inspects the local environment and package-manager availability.
2. It asks for the minimum required decisions first.
3. It opens optional customization sections only when the user wants deeper control.
4. It normalizes risky or unsupported combinations before files are written.
5. It generates code, docs, AI rules, and optional tooling.
6. It can install dependencies and initialize git immediately after generation.

If you want a full explanation of each question in the CLI, use the [Prompt Reference](./prompts.md).

## Default Philosophy

- Keep required questions focused on decisions that materially change the scaffold.
- Keep advanced choices optional so recommended defaults stay fast.
- Enable ESLint and Prettier by default because they are broad quality basics.
- Keep Husky and Commitlint optional because local hooks are workflow-specific.
- Prefer a working starter surface over a repo full of inert placeholders.

## Supported Project Intents

- landing pages
- frontend apps
- backend APIs
- fullstack apps
- microfrontend systems
- Chrome extensions
- CLI tools

## What Users Get After Generation

- starter UI or runtime surfaces that show project metadata
- architecture and getting-started docs
- `.devforge/project-plan.json` as a resolved source of truth
- stack-aware AI rule output
- optional linting, formatting, hooks, tests, Docker, and GitHub Actions setup
