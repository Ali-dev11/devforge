import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyAddFeature } from "../src/commands/add.js";
import { generateProject } from "../src/engines/generator.js";
import { buildDefaultPlan } from "../src/engines/prompts.js";
import type { CliOptions, EnvironmentInfo } from "../src/types.js";

const environment: EnvironmentInfo = {
  platform: "darwin",
  arch: "arm64",
  nodeVersion: "v22.12.0",
  recommendedPackageManager: "pnpm",
  packageManagers: {
    npm: { installed: true, version: "10.5.1", path: "/usr/bin/npm" },
    pnpm: { installed: true, version: "9.0.0", path: "/usr/local/bin/pnpm" },
    yarn: { installed: true, version: "4.1.0", path: "/usr/local/bin/yarn" },
    bun: { installed: true, version: "1.3.11", path: "/usr/local/bin/bun" },
  },
};

const cliOptions: CliOptions = {
  command: "init",
  resume: false,
  skipInstall: true,
  yes: true,
  outputDir: "/tmp/devforge-add-test",
  projectName: "devforge-add-test",
};

test("add rejects directories that are not recognized DevForge projects", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "devforge-add-non-project-"));

  await assert.rejects(
    () => applyAddFeature("docker", tempDir, environment, { skipInstall: true }),
    /does not look like a DevForge project/i,
  );
});

test("add docker enables Docker support and is idempotent on rerun", async () => {
  const targetDir = await mkdtemp(join(tmpdir(), "devforge-add-docker-"));
  const plan = buildDefaultPlan(environment, {
    ...cliOptions,
    outputDir: targetDir,
    projectName: "devforge-add-docker",
  });
  plan.targetDir = targetDir;

  await generateProject(plan, environment);

  const firstRun = await applyAddFeature("docker", targetDir, environment, {
    skipInstall: true,
  });
  const secondRun = await applyAddFeature("docker", targetDir, environment, {
    skipInstall: true,
  });

  const dockerfile = await readFile(join(targetDir, "Dockerfile"), "utf8");
  const storedPlan = JSON.parse(
    await readFile(join(targetDir, ".devforge", "project-plan.json"), "utf8"),
  ) as { tooling: { docker: boolean } };

  assert.equal(firstRun.featureAlreadyConfigured, false);
  assert.equal(secondRun.featureAlreadyConfigured, true);
  assert.equal(firstRun.installResult.dependencyInstall.succeeded, false);
  assert.match(firstRun.installResult.skipped.join(" "), /do not appear to be installed/i);
  assert.match(dockerfile, /FROM node:22-alpine/);
  assert.equal(storedPlan.tooling.docker, true);
});

test("add testing updates package scripts and writes test files", async () => {
  const targetDir = await mkdtemp(join(tmpdir(), "devforge-add-testing-"));
  const plan = buildDefaultPlan(environment, {
    ...cliOptions,
    outputDir: targetDir,
    projectName: "devforge-add-testing",
  });
  plan.targetDir = targetDir;
  plan.testing = {
    enabled: false,
    runner: "none",
    environment: "none",
    includeExampleTests: false,
  };

  await generateProject(plan, environment);

  const result = await applyAddFeature("testing", targetDir, environment, {
    skipInstall: true,
  });
  const packageJson = JSON.parse(
    await readFile(join(targetDir, "package.json"), "utf8"),
  ) as {
    scripts: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  const vitestConfig = await readFile(join(targetDir, "vitest.config.ts"), "utf8");
  const exampleTest = await readFile(join(targetDir, "src/__tests__/app.test.ts"), "utf8");

  assert.equal(result.featureAlreadyConfigured, false);
  assert.equal(result.installResult.dependencyInstall.succeeded, false);
  assert.match(result.installResult.skipped.join(" "), /skipped by flag/i);
  assert.equal(packageJson.scripts.test, "vitest run");
  assert.equal(packageJson.devDependencies.vitest, "latest");
  assert.match(vitestConfig, /defineConfig/);
  assert.match(exampleTest, /keeps the scaffold wired/i);
});

test("add ai-rules restores AI rule outputs for projects that skipped them initially", async () => {
  const targetDir = await mkdtemp(join(tmpdir(), "devforge-add-ai-rules-"));
  const plan = buildDefaultPlan(environment, {
    ...cliOptions,
    outputDir: targetDir,
    projectName: "devforge-add-ai-rules",
  });
  plan.targetDir = targetDir;
  plan.ai.tools = [];

  await generateProject(plan, environment);

  const result = await applyAddFeature("ai-rules", targetDir, environment, {
    skipInstall: true,
  });
  const agentsFile = await readFile(join(targetDir, "AGENTS.md"), "utf8");
  const cursorRules = await readFile(join(targetDir, ".cursor", "rules", "devforge.mdc"), "utf8");
  const claudeRules = await readFile(join(targetDir, ".claude", "rules", "devforge.md"), "utf8");
  const storedPlan = JSON.parse(
    await readFile(join(targetDir, ".devforge", "project-plan.json"), "utf8"),
  ) as { ai: { tools: string[] } };

  assert.equal(result.featureAlreadyConfigured, false);
  assert.deepEqual(storedPlan.ai.tools, ["cursor", "claude", "codex"]);
  assert.match(agentsFile, /AGENTS\.md/);
  assert.match(cursorRules, /DevForge/);
  assert.match(claudeRules, /DevForge/);
});
