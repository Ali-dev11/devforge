import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProjectPlan } from "../src/engines/decision.js";
import {
  applyIntentDefaults,
  buildDefaultPlan,
  getArchitectureChoicesForIntent,
} from "../src/engines/prompts.js";
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
  outputDir: "/tmp/devforge-test",
  projectName: "devforge-test",
};

test("normalization drops incompatible frontend choices and infers rule categories", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.frontend = {
    framework: "vue-vite",
    rendering: "client",
    styling: "tailwind-css",
    uiLibrary: "shadcn-ui",
    state: "zustand",
    dataFetching: "swr",
  };

  const result = normalizeProjectPlan(plan, environment);

  assert.equal(result.plan.frontend?.uiLibrary, "none");
  assert.equal(result.plan.frontend?.state, "none");
  assert.equal(result.plan.frontend?.dataFetching, "native-fetch");
  assert.ok(result.plan.ai.categories.includes("frontend"));
});

test("microfrontend intent forces architecture defaults", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.intent = "microfrontend-system";
  plan.architecture = "simple";
  plan.workspace.remoteApps = [];

  const result = normalizeProjectPlan(plan, environment);

  assert.equal(result.plan.architecture, "microfrontend");
  assert.equal(result.plan.workspace.microfrontendStrategy, "vite-federation");
  assert.deepEqual(result.plan.workspace.remoteApps, ["catalog", "dashboard"]);
});

test("intent defaults hydrate backend plans and drop frontend-only state", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.intent = "backend-api";

  applyIntentDefaults(plan);

  assert.equal(plan.frontend, undefined);
  assert.ok(plan.backend);
  assert.equal(plan.backend?.framework, "hono");
  assert.equal(plan.backend?.language, "typescript");
  assert.equal(plan.backend?.swagger, true);
});

test("architecture choices stay compatible with project intent", () => {
  assert.deepEqual(
    getArchitectureChoicesForIntent("backend-api").map((choice) => choice.value),
    ["simple", "modular", "monorepo"],
  );
  assert.deepEqual(
    getArchitectureChoicesForIntent("microfrontend-system").map((choice) => choice.value),
    ["microfrontend"],
  );
  assert.deepEqual(
    getArchitectureChoicesForIntent("chrome-extension").map((choice) => choice.value),
    ["modular"],
  );
});

test("nestjs javascript selections normalize back to typescript", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.intent = "backend-api";
  plan.backend = {
    framework: "nestjs",
    language: "javascript",
    adapter: "fastify",
    auth: [],
    orm: "none",
    database: "none",
    redis: false,
    swagger: true,
    websockets: false,
  };

  const result = normalizeProjectPlan(plan, environment);

  assert.equal(result.plan.backend?.language, "typescript");
  assert.match(result.warnings.join(" "), /NestJS is generated as a TypeScript-first stack/);
});
