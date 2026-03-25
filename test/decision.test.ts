import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProjectPlan } from "../src/engines/decision.js";
import { buildDefaultPlan } from "../src/engines/prompts.js";
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
