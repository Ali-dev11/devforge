# Changelog

All notable changes to this project will be documented in this file.

The format follows Keep a Changelog and the version numbers follow Semantic Versioning.

## [Unreleased]

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
