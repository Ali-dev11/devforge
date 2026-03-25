import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPOSITORY_URL = "https://github.com/Ali-dev11/devforge";

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, "\n");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeVersion(version) {
  return version.replace(/^v/, "").trim();
}

export function extractReleaseSection(changelog, version) {
  const normalized = normalizeVersion(version);
  const content = normalizeLineEndings(changelog);
  const startIndex = content.search(new RegExp(`^## \\[${escapeRegExp(normalized)}\\]`, "m"));

  if (startIndex < 0) {
    throw new Error(`Could not find release notes for version ${normalized} in CHANGELOG.md`);
  }

  const remainder = content.slice(startIndex);
  const nextHeadingIndex = remainder.slice(1).search(/\n## \[/);
  return (nextHeadingIndex < 0 ? remainder : remainder.slice(0, nextHeadingIndex + 1)).trim();
}

function extractUnreleasedSection(changelog) {
  const content = normalizeLineEndings(changelog);
  const startIndex = content.search(/^## \[Unreleased\]/m);
  if (startIndex < 0) {
    return "";
  }

  const remainder = content.slice(startIndex);
  const nextHeadingIndex = remainder.slice(1).search(/\n## \[/);
  const section = (nextHeadingIndex < 0 ? remainder : remainder.slice(0, nextHeadingIndex + 1)).trim();
  const body = section.replace(/^## \[Unreleased\]\n?/, "").trim();
  if (!body) {
    return "";
  }

  return `## [Unreleased]\n\n${body}`;
}

export function renderDocsChangelog(changelog) {
  const content = normalizeLineEndings(changelog);
  const unreleased = extractUnreleasedSection(content);
  const firstReleaseHeading = content.search(/^## \[\d+\.\d+\.\d+\]/m);
  const releasedHistory = firstReleaseHeading >= 0 ? content.slice(firstReleaseHeading).trim() : "";

  const sections = [unreleased, releasedHistory].filter(Boolean).join("\n\n");

  return [
    "---",
    "title: Changelog",
    "---",
    "",
    "# Changelog",
    "",
    "Track what changed in DevForge CLI across releases, including scaffolding behavior, runtime verification improvements, and release automation updates.",
    "",
    `- [GitHub Releases](${REPOSITORY_URL}/releases)`,
    `- [Repository Changelog](${REPOSITORY_URL}/blob/main/CHANGELOG.md)`,
    "",
    sections,
    "",
  ].join("\n");
}

function printUsage() {
  globalThis.console.error(
    [
      "Usage:",
      "  node scripts/changelog.mjs --version <version>",
      "  node scripts/changelog.mjs --docs <output-path>",
    ].join("\n"),
  );
}

function runCli() {
  const args = process.argv.slice(2);
  const changelogPath = resolve(process.cwd(), "CHANGELOG.md");
  const changelog = readFileSync(changelogPath, "utf8");

  if (args[0] === "--version" && args[1]) {
    process.stdout.write(`${extractReleaseSection(changelog, args[1])}\n`);
    return;
  }

  if (args[0] === "--docs" && args[1]) {
    const outputPath = resolve(process.cwd(), args[1]);
    writeFileSync(outputPath, renderDocsChangelog(changelog), "utf8");
    return;
  }

  printUsage();
  process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  runCli();
}
