import test from "node:test";
import assert from "node:assert/strict";
import { getDeploymentProfile } from "../src/guidance.js";
import { buildDefaultPlan, applyIntentDefaults } from "../src/engines/prompts.js";
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
  outputDir: "/tmp/devforge-deployment-profile-test",
  projectName: "devforge-deployment-profile-test",
};

test("render profile exposes managed-node deployment metadata for backend APIs", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.intent = "backend-api";
  applyIntentDefaults(plan);
  plan.backend = {
    framework: "fastify",
    language: "typescript",
    auth: [],
    orm: "none",
    database: "none",
    redis: false,
    swagger: true,
    websockets: false,
  };
  plan.deployment.target = "render";

  const profile = getDeploymentProfile(plan);

  assert.ok(profile);
  assert.equal(profile.target, "render");
  assert.equal(profile.category, "managed-node");
  assert.equal(profile.port, 3001);
  assert.equal(profile.healthPath, "/health");
  assert.match(profile.startCommand ?? "", /pnpm run start/);
  assert.deepEqual(
    profile.secrets.map((variable) => variable.name),
    ["RENDER_DEPLOY_HOOK_URL"],
  );
});

test("railway profile exposes deploy-time secrets and generated files", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.frontend = {
    framework: "nextjs",
    rendering: "ssr",
    styling: "vanilla-css",
    uiLibrary: "none",
    state: "none",
    dataFetching: "native-fetch",
  };
  plan.deployment.target = "railway";

  const profile = getDeploymentProfile(plan);

  assert.ok(profile);
  assert.equal(profile.target, "railway");
  assert.deepEqual(profile.generatedFiles, ["railway.toml", ".github/workflows/deploy.yml"]);
  assert.equal(profile.port, 3000);
  assert.equal(profile.healthPath, "/");
  assert.deepEqual(
    profile.secrets.map((variable) => variable.name),
    [
      "RAILWAY_TOKEN",
      "RAILWAY_PROJECT_ID",
      "RAILWAY_ENVIRONMENT_NAME",
      "RAILWAY_SERVICE_NAME",
    ],
  );
});
