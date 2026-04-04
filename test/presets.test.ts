import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeProjectPlanConfig } from "../src/config.js";
import { normalizeProjectPlan } from "../src/engines/decision.js";
import { readProjectPlanPreset } from "../src/presets.js";
import type { CliOptions, EnvironmentInfo, ProjectPlan } from "../src/types.js";

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
  outputDir: "/tmp/devforge-preset-test",
  projectName: "devforge-preset-test",
};

test("built-in frontend preset seeds a production-ready frontend app plan", async () => {
  const plan = await readProjectPlanPreset("frontend-app", environment, cliOptions);

  assert.equal(plan.intent, "frontend-app");
  assert.equal(plan.templateTier, "production");
  assert.equal(plan.frontend?.framework, "react-vite");
  assert.equal(plan.testing.runner, "vitest");
  assert.equal(plan.deployment.target, "none");
});

test("local preset files use the same normalization path as config-driven scaffolds", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "devforge-preset-file-"));
  const presetPath = join(tempDir, "backend-preset.json");
  const presetPlan: Partial<ProjectPlan> = {
    schemaVersion: 1,
    intent: "backend-api",
    architecture: "modular",
    packageManager: "pnpm",
    templateTier: "production",
    backend: {
      framework: "fastify",
      language: "typescript",
      auth: [],
      orm: "none",
      database: "none",
      redis: false,
      swagger: true,
      websockets: false,
    },
    testing: {
      enabled: true,
      runner: "jest",
      environment: "node",
      includeExampleTests: true,
    },
    deployment: {
      target: "docker-compose",
    },
  };

  await writeProjectPlanConfig(presetPath, presetPlan as ProjectPlan);

  const loadedPlan = await readProjectPlanPreset(presetPath, environment, cliOptions);
  const normalized = normalizeProjectPlan(loadedPlan, environment).plan;

  assert.equal(normalized.intent, "backend-api");
  assert.equal(normalized.backend?.framework, "fastify");
  assert.equal(normalized.deployment.target, "docker-compose");
  assert.equal(normalized.tooling.docker, true);
});
