---
title: Prompt Reference
---

# Prompt Reference

This page explains every major DevForge prompt, what it changes, and why it exists. The goal is to make the CLI feel predictable for new developers instead of feeling like a long list of unexplained questions.

## Core Setup

- `Project name`
  What it does: sets the generated package or workspace name and is reused in starter screens, docs, and metadata.
  Why it matters: this becomes part of the repo identity, so DevForge asks it up front.

- `Output directory`
  What it does: tells DevForge where to write the new project.
  Why it matters: the generator must know which folder to create or validate before it writes files. This is also how DevForge prevents accidental writes into the wrong place.

- `Node.js version`
  What it does: chooses whether the scaffold follows LTS, latest, or a custom version.
  Why it matters: runtime compatibility changes across modern toolchains, especially for frontend and extension stacks.

- `Custom Node.js version`
  What it does: records an explicit Node version when `Custom` is selected.
  Why it matters: some teams pin exact runtime versions for CI, containers, or deployment parity.

- `Package manager`
  What it does: decides the install command, lockfile, workspace behavior, and generated scripts.
  Why it matters: npm, pnpm, yarn, and bun all shape the generated project differently.

- `What are you building?`
  What it does: selects the project intent such as frontend app, backend API, microfrontend system, Chrome extension, or CLI tool.
  Why it matters: this is the main branching decision for the rest of the flow.

- `Architecture style`
  What it does: determines whether the scaffold is a single app, a modular codebase, a monorepo, or a microfrontend system when that intent supports it.
  Why it matters: architecture changes folder layout, scripts, generated docs, and workspace behavior.

- `Template tier`
  What it does: controls how much baseline project structure DevForge includes.
  Why it matters: some projects only need a starter, while others want more production-minded defaults immediately.

## Project Metadata

- `Customize project metadata?`
  What it does: decides whether to keep recommended metadata defaults or open the metadata questions.
  Why it matters: this keeps the default path fast for users who do not need custom metadata.

- `Project description`
  What it does: fills generated docs, starter surfaces, and metadata summaries.
  Why it matters: generated projects should explain themselves from the first commit.

- `License`
  What it does: determines the generated `LICENSE` file and metadata.
  Why it matters: licensing is part of project setup, especially for public repositories and client work.

## Frontend Prompts

- `Frontend framework`
  What it does: selects the frontend stack, such as Next.js, React with Vite, Astro, Nuxt, Vue, Svelte, or Solid.
  Why it matters: framework choice drives dependencies, starter files, build scripts, and testing compatibility.

- `Rendering mode`
  What it does: chooses client, static, SSR, SSG, or ISR when the selected stack supports it.
  Why it matters: rendering mode affects runtime behavior, deployment expectations, and generated defaults.

- `Customize frontend libraries and data layer?`
  What it does: decides whether to keep recommended frontend defaults or open the advanced frontend questions.
  Why it matters: not every project needs to choose styling, state, and data tools during the first scaffold.

- `Styling`
  What it does: chooses between Tailwind CSS, SCSS, CSS Modules, or vanilla CSS.
  Why it matters: styling choice changes generated files, dependencies, and the starter app shell.

- `UI library`
  What it does: adds or skips component-library dependencies such as shadcn/ui, MUI, Chakra UI, or Ant Design.
  Why it matters: UI-library choice affects component conventions and bundle setup from the start.

- `State layer`
  What it does: chooses whether the scaffold includes a state-management direction such as Redux Toolkit, Zustand, MobX, Jotai, or no dedicated state layer.
  Why it matters: state management is an architectural choice, not just a dependency checkbox.

- `Data fetching`
  What it does: selects a fetch strategy such as TanStack Query, RTK Query, SWR, Apollo Client, or native fetch.
  Why it matters: data access patterns often shape app architecture early.

## Backend Prompts

- `Backend framework`
  What it does: chooses NestJS, Express, Fastify, Hono, or Koa.
  Why it matters: framework choice changes server entry files, dependencies, and runtime defaults.

- `Language`
  What it does: chooses TypeScript or JavaScript where supported.
  Why it matters: it changes compiler setup, scripts, typings, and generated runtime files.

- `Configure backend capabilities?`
  What it does: decides whether to keep the recommended backend defaults or open backend capability questions.
  Why it matters: many users want a backend scaffold without deciding auth, ORM, database, and extras immediately.

- `NestJS adapter`
  What it does: picks Fastify or Express for generated NestJS projects.
  Why it matters: the adapter affects runtime behavior and dependencies.

- `Authentication`
  What it does: adds JWT and/or OAuth-related setup direction.
  Why it matters: auth choices affect generated dependency sets and starter guidance.

- `Database`
  What it does: chooses no database, PostgreSQL, or MongoDB.
  Why it matters: storage choice changes generated environment variables, packages, and ORM compatibility.

- `ORM / query layer`
  What it does: selects Prisma, Drizzle, or none when compatible with the chosen database.
  Why it matters: database abstraction is a long-lived architectural choice, so DevForge filters invalid combinations instead of generating broken setups.

- `Add Redis?`
  What it does: includes Redis-related packages and environment defaults.
  Why it matters: some APIs need caching or queue infrastructure immediately, while others do not.

- `Add Swagger docs?`
  What it does: includes framework-appropriate API documentation tooling when supported.
  Why it matters: API visibility is useful, but not every service needs it on day one.

- `Add WebSockets?`
  What it does: includes websocket support direction in generated dependencies and docs.
  Why it matters: real-time requirements should be explicit instead of implied.

## Workspace And Microfrontend Prompts

- `Monorepo tool`
  What it does: chooses TurboRepo or Nx for monorepo scaffolds.
  Why it matters: workspace tooling changes scripts, config files, and the developer workflow.

- `Microfrontend strategy`
  What it does: selects the microfrontend composition approach.
  Why it matters: microfrontends need deeper runtime coordination than normal workspaces. DevForge currently generates the supported Vite federation path.

- `Remote apps (comma separated)`
  What it does: names the generated remote applications for microfrontend workspaces.
  Why it matters: those names become remote package names, ports, docs, and host wiring.

## Chrome Extension Prompts

- `Extension type`
  What it does: chooses a React-based extension or a vanilla TypeScript extension.
  Why it matters: it changes the popup UI stack, dev dependencies, and output files.

- `Customize extension entry points?`
  What it does: decides whether to keep the default popup, background, and content-script layout or customize it.
  Why it matters: some extension projects need the full set, while others only need one or two surfaces.

- `Include background script?`
  What it does: generates or skips the extension service worker.
  Why it matters: background behavior is optional in some extension types.

- `Include content script?`
  What it does: generates or skips the page-injected script.
  Why it matters: not every extension interacts directly with web pages.

- `Include popup UI?`
  What it does: generates or skips the popup interface.
  Why it matters: some extensions are headless or options-page driven.

## Testing Prompts

- `Add testing setup?`
  What it does: turns generated testing support on or off.
  Why it matters: some prototypes want a minimal scaffold, while most production-minded projects want tests immediately.

- `Customize testing setup?`
  What it does: decides whether to keep recommended test defaults or choose the runner and environment manually.
  Why it matters: this keeps the happy path short for users who do not need test-level fine tuning.

- `Test runner`
  What it does: chooses Vitest, Jest, Playwright, or Cypress when applicable.
  Why it matters: different stacks and teams prefer different testing styles.

- `Test environment`
  What it does: chooses `node`, `jsdom`, or `happy-dom` for non-browser-E2E runners.
  Why it matters: runtime expectations for backend tests and frontend tests are different.

- `Generate example test cases?`
  What it does: includes starter tests instead of only adding config.
  Why it matters: starter tests prove that the generated test setup actually runs.

## AI Rules Prompts

- `Customize AI tools and rules?`
  What it does: decides whether to keep recommended AI defaults or choose tools, strictness, and rule categories manually.
  Why it matters: some teams want quick defaults, while others want stack-specific AI control from the start.

- `AI tools to configure`
  What it does: chooses which AI assistants receive generated rules.
  Why it matters: different teams work across Cursor, Claude, Codex, or a combination of them.

- `Rule mode`
  What it does: sets how opinionated the generated rules should be.
  Why it matters: minimal, balanced, and strict modes let teams choose how much policy they want AI tools to follow.

- `Rule categories`
  What it does: selects which rule groups are generated for the chosen stack.
  Why it matters: frontend-only projects should not be burdened with backend rule packs, and DevForge filters those combinations automatically.

## Tooling And DevOps Prompts

- `Customize linting, formatting, hooks, and DevOps tooling?`
  What it does: decides whether to keep the recommended quality-tool defaults or customize them.
  Why it matters: not every project wants the same level of process tooling at scaffold time.

- `DevOps and tooling`
  What it does: enables or disables ESLint, Prettier, Husky, Commitlint, Docker, and GitHub Actions.
  Why it matters: these are useful, but they should be intentional rather than blindly forced into every scaffold.

- `ESLint strictness`
  What it does: adjusts how opinionated the generated lint config is.
  Why it matters: some teams want basic safety rules, while others want stricter enforcement.

- `Prettier strictness`
  What it does: controls how strongly formatting is enforced in generated checks and hooks.
  Why it matters: teams vary in how hard they want formatting to gate local work.

- `Husky strictness`
  What it does: changes how aggressive the generated git-hook behavior is when Husky is enabled.
  Why it matters: hooks can be helpful guardrails, but they can also slow local workflows if they are too strict for the team.

## Git Prompts

- `Initialize git repository?`
  What it does: runs `git init` after generation.
  Why it matters: many users want to start versioning immediately, but DevForge still leaves that as a choice.

- `Prepare SSH setup guidance?`
  What it does: includes guidance in generated docs instead of modifying local SSH config directly.
  Why it matters: SSH is environment-specific and should not be changed automatically.

- `Add a remote URL?`
  What it does: decides whether DevForge should add `origin` during scaffold setup.
  Why it matters: some projects already have a known destination repository and some do not.

- `Remote URL`
  What it does: defines the git remote URL used when `Add a remote URL?` is enabled.
  Why it matters: it saves an extra manual step for users who already know the target repository.
