import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildProjectPlanFromConfig,
  readProjectPlanConfig,
  serializeProjectPlanConfig,
  writeProjectPlanConfig,
} from "../src/config.js";
import { normalizeProjectPlan } from "../src/engines/decision.js";
import { applyIntentDefaults, buildDefaultPlan } from "../src/engines/prompts.js";
import { buildProjectFiles } from "../src/templates.js";
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
  outputDir: "/tmp/devforge-config-test",
  projectName: "devforge-config-test",
};

test("serialized config omits the machine-specific target directory", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  const config = serializeProjectPlanConfig(plan);

  assert.equal("targetDir" in config, false);
  assert.equal(config.schemaVersion, 1);
  assert.equal(config.projectName, plan.projectName);
});

test("config-driven plans recreate the same generated scaffold as the normalized source plan", async () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.intent = "fullstack-app";
  applyIntentDefaults(plan);
  plan.packageManager = "pnpm";
  plan.projectName = "config-repro-app";
  plan.targetDir = "/tmp/config-repro-app";
  plan.backend = {
    framework: "fastify",
    language: "typescript",
    auth: ["jwt"],
    orm: "prisma",
    database: "postgresql",
    redis: true,
    swagger: true,
    websockets: false,
  };

  const normalized = normalizeProjectPlan(plan, environment).plan;
  const configDir = await mkdtemp(join(tmpdir(), "devforge-config-roundtrip-"));
  const configPath = join(configDir, "devforge.config.json");

  await writeProjectPlanConfig(configPath, normalized);

  const loaded = await readProjectPlanConfig(configPath, environment, {
    ...cliOptions,
    outputDir: normalized.targetDir,
    projectName: normalized.projectName,
  });
  const loadedNormalized = normalizeProjectPlan(loaded, environment).plan;

  const originalFiles = buildProjectFiles(normalized, environment).map((file) => ({
    path: file.path,
    content: file.content,
    executable: file.executable ?? false,
  }));
  const loadedFiles = buildProjectFiles(loadedNormalized, environment).map((file) => ({
    path: file.path,
    content: file.content,
    executable: file.executable ?? false,
  }));

  assert.deepEqual(loadedFiles, originalFiles);
});

test("config-driven plans still normalize invalid stack combinations", () => {
  const plan = buildProjectPlanFromConfig(
    {
      schemaVersion: 1,
      projectName: "config-next-bun",
      intent: "frontend-app",
      packageManager: "bun",
      frontend: {
        framework: "nextjs",
        rendering: "ssr",
        styling: "vanilla-css",
        uiLibrary: "none",
        state: "none",
        dataFetching: "native-fetch",
      },
    },
    environment,
    cliOptions,
  );

  const result = normalizeProjectPlan(plan, environment);

  assert.notEqual(result.plan.packageManager, "bun");
  assert.match(result.warnings.join(" "), /switching package manager/i);
});
