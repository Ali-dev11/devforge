import test from "node:test";
import assert from "node:assert/strict";
import {
  getAvailableRuleCategories,
  normalizeProjectPlan,
} from "../src/engines/decision.js";
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

test("normalization drops incompatible frontend choices and filters AI rule categories", () => {
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
  assert.ok(!result.plan.ai.categories.includes("backend"));
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

test("microfrontend plans normalize to supported frontend scaffolds", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.intent = "microfrontend-system";
  plan.architecture = "microfrontend";
  plan.frontend = {
    framework: "astro",
    rendering: "isr",
    styling: "tailwind-css",
    uiLibrary: "none",
    state: "tanstack-store",
    dataFetching: "rtk-query",
  };

  const result = normalizeProjectPlan(plan, environment);

  assert.equal(result.plan.frontend?.framework, "react-vite");
  assert.equal(result.plan.frontend?.rendering, "client");
  assert.equal(result.plan.frontend?.state, "redux-toolkit");
  assert.equal(result.plan.frontend?.dataFetching, "rtk-query");
  assert.match(
    result.warnings.join(" "),
    /Microfrontend scaffolds are currently generated for React \(Vite\)/,
  );
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

test("frontend-only intents expose only applicable AI rule categories", () => {
  const landingPagePlan = buildDefaultPlan(environment, cliOptions);
  landingPagePlan.intent = "landing-page";
  landingPagePlan.architecture = "simple";
  applyIntentDefaults(landingPagePlan);

  assert.deepEqual(getAvailableRuleCategories(landingPagePlan), [
    "core",
    "security",
    "testing",
    "frontend",
  ]);

  const extensionPlan = buildDefaultPlan(environment, cliOptions);
  extensionPlan.intent = "chrome-extension";
  applyIntentDefaults(extensionPlan);

  assert.deepEqual(getAvailableRuleCategories(extensionPlan), [
    "core",
    "security",
    "testing",
    "frontend",
    "architecture",
  ]);
});

test("normalization removes backend AI categories from frontend-only plans", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.intent = "landing-page";
  plan.architecture = "simple";
  applyIntentDefaults(plan);
  plan.ai.categories = ["core", "frontend", "backend", "security"];

  const result = normalizeProjectPlan(plan, environment);

  assert.deepEqual(result.plan.ai.categories, ["core", "frontend", "security"]);
  assert.match(
    result.warnings.join(" "),
    /Removed AI rule categories that do not apply to the selected project stack/,
  );
});
