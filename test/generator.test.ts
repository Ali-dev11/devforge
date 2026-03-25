import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateProject } from "../src/engines/generator.js";
import { applyIntentDefaults, buildDefaultPlan } from "../src/engines/prompts.js";
import { buildProjectFiles } from "../src/templates.js";
import { writeGeneratedFiles } from "../src/utils/fs.js";
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

test("fullstack scripts honor the selected package manager", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.intent = "fullstack-app";
  applyIntentDefaults(plan);

  const files = buildProjectFiles(plan, environment);
  const packageJsonFile = files.find((file) => file.path === "package.json");

  assert.ok(packageJsonFile);

  const packageJson = JSON.parse(packageJsonFile.content) as {
    scripts: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts.dev,
    'concurrently -n web,api "pnpm run dev:web" "pnpm run dev:api"',
  );
  assert.equal(
    packageJson.scripts.build,
    "pnpm run build:web && pnpm run build:api",
  );
});

test("workspace scaffolds local tsconfig files, app tests, and root tooling dependencies", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.intent = "fullstack-app";
  plan.architecture = "monorepo";
  applyIntentDefaults(plan);
  plan.testing.runner = "jest";
  plan.testing.environment = "node";

  const files = buildProjectFiles(plan, environment);
  const paths = new Set(files.map((file) => file.path));
  const rootPackageJsonFile = files.find((file) => file.path === "package.json");

  assert.ok(rootPackageJsonFile);

  const rootPackageJson = JSON.parse(rootPackageJsonFile.content) as {
    scripts: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  assert.ok(paths.has("apps/web/tsconfig.json"));
  assert.ok(paths.has("apps/api/tsconfig.json"));
  assert.ok(paths.has("apps/web/jest.config.ts"));
  assert.ok(paths.has("apps/api/jest.config.ts"));
  assert.equal(rootPackageJson.scripts.test, "turbo run test");
  assert.equal(rootPackageJson.devDependencies.typescript, "latest");
  assert.equal(rootPackageJson.devDependencies.eslint, "latest");
  assert.equal(rootPackageJson.devDependencies.turbo, "latest");
});

test("generateProject rejects file targets that are not directories", async () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  const tempDir = await mkdtemp(join(tmpdir(), "devforge-file-target-"));
  const blockedPath = join(tempDir, "blocked");

  await writeFile(blockedPath, "not a directory", "utf8");
  plan.targetDir = blockedPath;

  await assert.rejects(
    generateProject(plan, environment),
    /Target path is not a directory/,
  );
});

test("writeGeneratedFiles blocks duplicate and escaping output paths", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "devforge-write-"));

  await assert.rejects(
    writeGeneratedFiles(tempDir, [
      { path: "README.md", content: "a" },
      { path: "README.md", content: "b" },
    ]),
    /Duplicate generated file path/,
  );

  await assert.rejects(
    writeGeneratedFiles(tempDir, [{ path: "../escape.txt", content: "x" }]),
    /outside the target directory/,
  );
});
