import test from "node:test";
import assert from "node:assert/strict";
import { buildDefaultPlan } from "../src/engines/prompts.js";
import { buildProjectFiles } from "../src/templates.js";
import type { CliOptions, EnvironmentInfo } from "../src/types.js";

const environment: EnvironmentInfo = {
  platform: "darwin",
  arch: "arm64",
  nodeVersion: "v22.0.0",
  recommendedPackageManager: "pnpm",
  packageManagers: {
    npm: { installed: true, version: "10.5.1", path: "/usr/bin/npm" },
    pnpm: { installed: true, version: "9.0.0", path: "/usr/local/bin/pnpm" },
    yarn: { installed: false },
    bun: { installed: false },
  },
};

const cliOptions: CliOptions = {
  command: "init",
  resume: false,
  skipInstall: true,
  yes: true,
  outputDir: "/tmp/devforge-generator-test",
  projectName: "devforge-generator-test",
};

test("generator returns a runnable default frontend scaffold", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  const files = buildProjectFiles(plan, environment);
  const paths = new Set(files.map((file) => file.path));
  const packageJsonFile = files.find((file) => file.path === "package.json");
  const readmeFile = files.find((file) => file.path === "README.md");

  assert.ok(packageJsonFile);
  assert.ok(readmeFile);

  const packageJson = JSON.parse(packageJsonFile.content) as {
    scripts: Record<string, string>;
  };

  assert.ok(paths.has("package.json"));
  assert.ok(paths.has("README.md"));
  assert.ok(paths.has("docs/getting-started.md"));
  assert.ok(paths.has(".editorconfig"));
  assert.ok(paths.has(".github/workflows/ci.yml"));
  assert.ok(paths.has("src/App.tsx"));
  assert.ok(paths.has("vitest.config.ts"));
  assert.ok(paths.has("src/__tests__/app.test.ts"));
  assert.ok(paths.has("vite.config.ts"));
  assert.equal(
    packageJson.scripts.check,
    "eslint . && tsc -p tsconfig.json --noEmit && prettier --check . && vite build && vitest run",
  );
  assert.match(readmeFile.content, /Quick Start/);
  assert.match(readmeFile.content, /Common Commands/);
});
