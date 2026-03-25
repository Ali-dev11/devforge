import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractReleaseSection, renderDocsChangelog } from "../scripts/changelog.mjs";

test("extractReleaseSection returns the requested release block", () => {
  const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
  const section = extractReleaseSection(changelog, "0.3.3");

  assert.match(section, /^## \[0\.3\.3\] - 2026-03-26/m);
  assert.match(section, /tag-driven GitHub release workflow/);
});

test("renderDocsChangelog creates a docs-friendly changelog page", () => {
  const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
  const docsPage = renderDocsChangelog(changelog);
  const committedDocsPage = readFileSync(new URL("../docs/changelog.md", import.meta.url), "utf8");

  assert.match(docsPage, /^---\ntitle: Changelog\n---/);
  assert.match(docsPage, /# Changelog/);
  assert.match(docsPage, /\[GitHub Releases\]\(https:\/\/github\.com\/Ali-dev11\/devforge\/releases\)/);
  assert.match(docsPage, /## \[0\.3\.3\] - 2026-03-26/);
  assert.equal(committedDocsPage, docsPage);
});
