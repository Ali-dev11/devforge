# Changelog

All notable changes to this project will be documented in this file.

The format follows Keep a Changelog and the version numbers follow Semantic Versioning.

## [Unreleased]

## [0.2.0] - 2026-03-25

### Fixed

- Prevented interactive prompt crashes when switching from default frontend setup to backend-oriented project flows.
- Restricted architecture choices by project intent so incompatible combinations such as backend plus microfrontend are no longer offered.
- Added safer default select handling and regression coverage for backend and non-frontend prompt paths.

### Changed

- Renamed the npm package to `@ali-dev11/devforge`.
- Updated user-facing install and CLI examples to use the shorter package name.
- Added release scripts for patch, minor, and major version bumps with pre-release validation.

## [0.1.0] - 2026-03-25

### Added

- Initial public-ready DevForge CLI foundation
- Added production repo setup with lint, CI, typecheck, smoke workflow, and package exports
- Expanded repository documentation and generated-project documentation
- Improved generated scaffold setup scripts and baseline project docs
- Added MIT licensing, npm publishing documentation, GitHub Pages docs setup, and repository community health files
