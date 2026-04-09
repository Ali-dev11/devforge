import test from "node:test";
import assert from "node:assert/strict";
import {
  getAvailableRuleCategories,
  normalizeProjectPlan,
} from "../src/engines/decision.js";
import {
  applyIntentDefaultsForChange,
  applyIntentDefaults,
  buildDefaultPlan,
  getRecommendedRuleCategories,
  getArchitectureChoicesForIntent,
} from "../src/engines/prompts.js";
import {
  deploymentTargetLabel,
  getSupportedBackendLanguages,
  getSupportedDeploymentTargets,
  getSupportedDataFetchingChoicesForState,
  getSupportedFrontendFrameworks,
  getSupportedPackageManagers,
  getSupportedRenderingModes,
  getSupportedTestEnvironments,
  getSupportedTestRunners,
} from "../src/guidance.js";
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

test("unsupported microfrontend strategies normalize to vite federation", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.intent = "microfrontend-system";
  plan.architecture = "microfrontend";
  plan.workspace.microfrontendStrategy = "single-spa";

  const result = normalizeProjectPlan(plan, environment);

  assert.equal(result.plan.workspace.microfrontendStrategy, "vite-federation");
  assert.match(result.warnings.join(" "), /switching strategy to vite-federation/i);
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
    getArchitectureChoicesForIntent("frontend-app").map((choice) => choice.value),
    ["simple", "modular", "monorepo"],
  );
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
  assert.match(result.warnings.join(" "), /switching backend language to TypeScript|generated as a typescript stack/i);
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

test("intent changes reset scoped defaults before optional sections are skipped", () => {
  const landingPagePlan = buildDefaultPlan(environment, cliOptions);
  applyIntentDefaultsForChange(landingPagePlan, landingPagePlan.intent);
  landingPagePlan.intent = "landing-page";

  applyIntentDefaultsForChange(landingPagePlan, "frontend-app");

  assert.equal(landingPagePlan.frontend?.framework, "react-vite");
  assert.equal(landingPagePlan.frontend?.rendering, "static");
  assert.equal(landingPagePlan.frontend?.state, "none");
  assert.equal(landingPagePlan.frontend?.dataFetching, "native-fetch");

  const backendPlan = buildDefaultPlan(environment, cliOptions);
  backendPlan.intent = "backend-api";

  applyIntentDefaultsForChange(backendPlan, "frontend-app");

  assert.equal(backendPlan.frontend, undefined);
  assert.equal(backendPlan.backend?.framework, "hono");
  assert.equal(backendPlan.testing.runner, "jest");
  assert.equal(backendPlan.testing.environment, "node");
});

test("recommended AI categories expand default selections to the current stack", () => {
  const frontendPlan = buildDefaultPlan(environment, cliOptions);

  assert.deepEqual(getRecommendedRuleCategories(frontendPlan), [
    "core",
    "security",
    "testing",
    "frontend",
  ]);

  const fullstackPlan = buildDefaultPlan(environment, cliOptions);
  fullstackPlan.intent = "fullstack-app";
  applyIntentDefaultsForChange(fullstackPlan, "frontend-app");

  assert.deepEqual(getRecommendedRuleCategories(fullstackPlan), [
    "core",
    "security",
    "testing",
    "frontend",
    "backend",
  ]);
});

test("custom frontend node versions warn when they fall below scaffold requirements", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.nodeStrategy = "custom";
  plan.customNodeVersion = "22.0.0";

  const result = normalizeProjectPlan(plan, environment);

  assert.match(
    result.warnings.join(" "),
    /below the recommended minimum for this stack/i,
  );
});

test("drizzle with mongodb normalizes to a supported backend setup", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.intent = "backend-api";
  applyIntentDefaults(plan);
  plan.backend = {
    framework: "koa",
    language: "typescript",
    auth: [],
    orm: "drizzle",
    database: "mongodb",
    redis: false,
    swagger: true,
    websockets: false,
  };

  const result = normalizeProjectPlan(plan, environment);

  assert.equal(result.plan.backend?.database, "mongodb");
  assert.equal(result.plan.backend?.orm, "none");
  assert.match(result.warnings.join(" "), /Drizzle ORM does not support MongoDB/i);
});

test("bun is only offered for verified stack paths", () => {
  assert.deepEqual(getSupportedPackageManagers("frontend-app", "simple"), [
    "npm",
    "pnpm",
    "yarn",
    "bun",
  ]);
  assert.deepEqual(getSupportedPackageManagers("backend-api", "simple"), [
    "npm",
    "pnpm",
    "yarn",
  ]);
  assert.deepEqual(getSupportedPackageManagers("microfrontend-system", "microfrontend"), [
    "npm",
    "pnpm",
    "yarn",
  ]);
  assert.deepEqual(getSupportedFrontendFrameworks("bun", "simple"), [
    "react-vite",
    "astro",
    "remix",
    "vue-vite",
    "svelte",
    "solidjs",
  ]);
});

test("deployment targets are only offered for verified stack pairs and normalize unsupported selections", () => {
  const frontendPlan = buildDefaultPlan(environment, cliOptions);
  frontendPlan.frontend = {
    framework: "react-vite",
    rendering: "client",
    styling: "tailwind-css",
    uiLibrary: "shadcn-ui",
    state: "zustand",
    dataFetching: "tanstack-query",
  };

  assert.deepEqual(getSupportedDeploymentTargets(frontendPlan), [
    "none",
    "vercel",
    "netlify",
    "render",
  ]);

  const unsupportedPlan = buildDefaultPlan(environment, cliOptions);
  unsupportedPlan.frontend = {
    framework: "astro",
    rendering: "static",
    styling: "tailwind-css",
    uiLibrary: "none",
    state: "none",
    dataFetching: "native-fetch",
  };
  unsupportedPlan.deployment.target = "vercel";

  const unsupportedResult = normalizeProjectPlan(unsupportedPlan, environment);
  assert.equal(unsupportedResult.plan.deployment.target, "none");
  assert.match(
    unsupportedResult.warnings.join(" "),
    new RegExp(deploymentTargetLabel("vercel"), "i"),
  );

  const backendPlan = buildDefaultPlan(environment, cliOptions);
  backendPlan.intent = "backend-api";
  applyIntentDefaults(backendPlan);
  backendPlan.backend = {
    framework: "hono",
    language: "typescript",
    auth: [],
    orm: "none",
    database: "none",
    redis: false,
    swagger: true,
    websockets: false,
  };
  backendPlan.deployment.target = "docker-compose";

  const backendResult = normalizeProjectPlan(backendPlan, environment);
  assert.equal(backendResult.plan.deployment.target, "docker-compose");
  assert.equal(backendResult.plan.tooling.docker, true);
  assert.deepEqual(getSupportedDeploymentTargets(backendPlan), [
    "none",
    "docker-compose",
    "render",
    "railway",
  ]);

  const nextPlan = buildDefaultPlan(environment, cliOptions);
  nextPlan.frontend = {
    framework: "nextjs",
    rendering: "ssr",
    styling: "vanilla-css",
    uiLibrary: "none",
    state: "none",
    dataFetching: "native-fetch",
  };

  assert.deepEqual(getSupportedDeploymentTargets(nextPlan), [
    "none",
    "vercel",
    "render",
    "railway",
  ]);
});

test("remix rendering stays on supported modes", () => {
  assert.deepEqual(getSupportedRenderingModes("remix", "simple"), ["ssr"]);

  const plan = buildDefaultPlan(environment, cliOptions);
  plan.packageManager = "bun";
  plan.frontend = {
    framework: "remix",
    rendering: "isr",
    styling: "tailwind-css",
    uiLibrary: "chakra-ui",
    state: "jotai",
    dataFetching: "apollo-client",
  };

  const result = normalizeProjectPlan(plan, environment);

  assert.equal(result.plan.frontend?.framework, "remix");
  assert.equal(result.plan.frontend?.rendering, "ssr");
  assert.match(result.warnings.join(" "), /does not support isr rendering/i);
});

test("normalization moves unsupported bun framework selections onto a verified package manager", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.packageManager = "bun";
  plan.frontend = {
    framework: "nextjs",
    rendering: "ssr",
    styling: "vanilla-css",
    uiLibrary: "none",
    state: "none",
    dataFetching: "native-fetch",
  };

  const result = normalizeProjectPlan(plan, environment);

  assert.equal(result.plan.frontend?.framework, "nextjs");
  assert.notEqual(result.plan.packageManager, "bun");
  assert.match(result.warnings.join(" "), /not currently verified for nextjs/i);
});

test("browser e2e runners only appear on supported stacks", () => {
  const backendPlan = buildDefaultPlan(environment, cliOptions);
  backendPlan.intent = "backend-api";
  applyIntentDefaults(backendPlan);

  assert.deepEqual(getSupportedTestRunners(backendPlan), ["vitest", "jest"]);

  const extensionPlan = buildDefaultPlan(environment, cliOptions);
  extensionPlan.intent = "chrome-extension";
  applyIntentDefaults(extensionPlan);

  assert.deepEqual(getSupportedTestRunners(extensionPlan), ["vitest", "jest"]);
  assert.deepEqual(getSupportedTestEnvironments(extensionPlan, "jest"), ["node", "jsdom"]);
  assert.deepEqual(getSupportedTestEnvironments(extensionPlan, "vitest"), ["node", "jsdom", "happy-dom"]);
});

test("normalization drops unsupported jest test environments to a compatible fallback", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.intent = "chrome-extension";
  applyIntentDefaults(plan);
  plan.testing = {
    enabled: true,
    runner: "jest",
    environment: "happy-dom",
    includeExampleTests: true,
  };

  const result = normalizeProjectPlan(plan, environment);

  assert.equal(result.plan.testing.environment, "jsdom");
  assert.match(result.warnings.join(" "), /switching test environment to jsdom/i);
});

test("backend language choices stay stack-aware", () => {
  assert.deepEqual(getSupportedBackendLanguages("nestjs"), ["typescript"]);
  assert.deepEqual(getSupportedBackendLanguages("hono"), ["typescript", "javascript"]);
});

test("rtk query is only offered when the selected state layer is compatible", () => {
  assert.deepEqual(
    getSupportedDataFetchingChoicesForState("react-vite", "frontend-app", "jotai").includes("rtk-query"),
    false,
  );
  assert.deepEqual(
    getSupportedDataFetchingChoicesForState("react-vite", "frontend-app", "redux-toolkit").includes("rtk-query"),
    true,
  );
});
