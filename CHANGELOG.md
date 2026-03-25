# Changelog

All notable changes to this project will be documented in this file.

The format follows Keep a Changelog and the version numbers follow Semantic Versioning.

## [Unreleased]

## [0.3.2] - 2026-03-26

### Fixed

- Hardened generated runtime-matrix process shutdown by terminating the full spawned process group for preview and start commands, which prevents Linux CI jobs from lingering after verification logs show completion.

## [0.3.1] - 2026-03-26

### Changed

- Reduced CI runner pressure by grouping generated runtime scenarios into a smaller set of runtime-matrix jobs instead of spawning one hosted-runner job per scenario.
- Made generated runtime verification wait for repository validation to pass before consuming matrix capacity, so bad commits fail faster and do not queue unnecessary stack jobs.
- Updated this repository and generated project GitHub Actions workflows to use newer `actions/checkout` and `actions/setup-node` releases.

### Fixed

- Added workflow-level concurrency cancellation so superseded pushes stop older CI runs instead of leaving stale jobs queued behind newer commits.

## [0.3.0] - 2026-03-26

### Added

- Added a generated-project runtime matrix runner that scaffolds representative stacks, installs dependencies, builds them, and verifies real runtime surfaces or production artifacts.
- Added a GitHub Actions matrix job for generated stack verification alongside the existing repository validation job.
- Added regression coverage that enforces runtime-matrix coverage across every primary project intent and every backend framework surface.

### Changed

- Raised generated frontend and extension project engine declarations to match the current Vite-family toolchain requirements.
- Documented the local runtime-matrix workflow in contributor docs and development docs.

### Fixed

- Added Node compatibility warnings when users choose a custom Node version that is too old for the selected frontend-oriented scaffold.
- Added Node type definitions to generated TypeScript configs so backend, fullstack, and CLI projects build cleanly when they reference `process`.
- Tightened the runtime verifier so CLI JSON checks execute the built binary directly instead of parsing npm wrapper output.
- Fixed generated Next.js projects to include Next-specific type declarations and tsconfig settings so app-directory CSS imports typecheck during production builds.
- Fixed generated fullstack React plus API projects to compile server code through a dedicated server tsconfig instead of typechecking browser entrypoints with NodeNext emit settings.
- Fixed generated NestJS projects to enable decorator compiler options required for controller methods.
- Added a no-op build script for JavaScript backend scaffolds so install/build/run verification stays consistent across backend language choices.
- Relaxed frontend runtime probes to validate successful startup instead of waiting for client-rendered HTML content that only appears after hydration.
- Fixed Nuxt runtime verification to start the built Nitro server directly instead of passing unsupported preview arguments.

## [0.2.3] - 2026-03-25

### Added

- Generated richer starter surfaces across the supported intents:
  frontend apps now render a project-details page,
  backend APIs expose structured project metadata from `/` and `/health`,
  CLI scaffolds print project info and support `--json`,
  Chrome extensions show a detailed popup and log extension metadata,
  and microfrontend host/remote apps identify their role and generation source.
- Added regression coverage for starter surfaces across every supported intent.

### Changed

- Expanded the scaffold audit coverage so every intent now emits a clear primary experience surface instead of only a minimal placeholder.
- Threaded DevForge package metadata through generated outputs so new projects show the creator, package name, and CLI version consistently.

### Fixed

- Corrected stale generated starter metadata by sourcing generator identity from the real CLI package instead of duplicating hardcoded values.
- Tightened the microfrontend host/remote starter content so those apps no longer look like generic workspace frontends.

## [0.2.2] - 2026-03-25

### Changed

- Split the interactive flow into core decisions and optional advanced sections so users can keep recommended defaults for metadata, frontend libraries, backend capabilities, testing, AI rules, and tooling without answering every detail prompt.
- Skipped one-option frontend prompts automatically for constrained flows such as microfrontend scaffolds.
- Expanded default AI rule selection to the full stack-relevant category set when users keep the recommended configuration.

### Fixed

- Reset intent-specific defaults when users switch project type during prompting, preventing stale frontend-app defaults from leaking into landing page, backend API, chrome extension, and other flows.
- Ensured backend and testing defaults remain valid when optional advanced questions are skipped, including a safe default adapter for NestJS.

## [0.2.1] - 2026-03-25

### Fixed

- Made AI rule category prompts stack-aware so frontend-only flows no longer offer backend rules.
- Filtered invalid AI rule categories out of normalized plans for resume, seed, and compatibility-adjusted flows.
- Added regression coverage for rule-category availability across landing page, chrome extension, and other intent-specific paths.

## [0.2.0] - 2026-03-25

### Fixed

- Prevented interactive prompt crashes when switching from default frontend setup to backend-oriented project flows.
- Restricted architecture choices by project intent so incompatible combinations such as backend plus microfrontend are no longer offered.
- Added safer default select handling and regression coverage for backend and non-frontend prompt paths.
- Added the required `packageManager` metadata to generated workspace roots so TurboRepo can resolve workspaces correctly.
- Fixed generated fullstack scripts to honor the selected package manager instead of hardcoding `npm`.
- Fixed workspace and microfrontend scaffolds to generate local app `tsconfig` and test config files where needed.
- Prevented generated output from writing duplicate paths, escaping the target directory, or targeting an existing file path as a directory.
- Fixed CLI version output so `--version` stays aligned with `package.json`.

### Changed

- Renamed the npm package to `@ali-dev11/devforge`.
- Updated user-facing install and CLI examples to use the shorter package name.
- Added release scripts for patch, minor, and major version bumps with pre-release validation.
- Normalized microfrontend scaffolds to the currently supported React (Vite) client-rendered setup and removed the stray default `apps/web` package from microfrontend outputs.

## [0.1.0] - 2026-03-25

### Added

- Initial public-ready DevForge CLI foundation
- Added production repo setup with lint, CI, typecheck, smoke workflow, and package exports
- Expanded repository documentation and generated-project documentation
- Improved generated scaffold setup scripts and baseline project docs
- Added MIT licensing, npm publishing documentation, GitHub Pages docs setup, and repository community health files
