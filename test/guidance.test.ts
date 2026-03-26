import test from "node:test";
import assert from "node:assert/strict";
import { buildDefaultPlan } from "../src/engines/prompts.js";
import {
  buildRuntimeGuidance,
  buildTemplateGuidance,
} from "../src/guidance.js";
import type { CliOptions, EnvironmentInfo, InstallResult } from "../src/types.js";

const cliOptions: CliOptions = {
  command: "init",
  resume: false,
  skipInstall: true,
  yes: true,
  outputDir: "/tmp/devforge-guidance-test",
  projectName: "devforge-guidance-test",
};

function createEnvironment(platform: NodeJS.Platform): EnvironmentInfo {
  return {
    platform,
    arch: platform === "win32" ? "x64" : "arm64",
    nodeVersion: "v22.0.0",
    recommendedPackageManager: "pnpm",
    packageManagers: {
      npm: { installed: true, version: "10.5.1", path: "/usr/bin/npm" },
      pnpm: { installed: true, version: "9.0.0", path: "/usr/local/bin/pnpm" },
      yarn: { installed: true, version: "4.1.0", path: "/usr/local/bin/yarn" },
      bun: { installed: true, version: "1.2.19", path: "/usr/local/bin/bun" },
    },
    systemTools: {
      git: { installed: true, version: "2.45.1", path: "/usr/bin/git" },
      docker: { installed: true, version: "27.0.0", path: "/usr/local/bin/docker" },
      corepack: { installed: true, version: "0.29.3", path: "/usr/local/bin/corepack" },
    },
  };
}

function createInstallResult(
  overrides: Partial<InstallResult["dependencyInstall"]> = {},
): InstallResult {
  return {
    executed: [],
    skipped: [],
    dependencyInstall: {
      attempted: true,
      succeeded: true,
      skipped: false,
      available: true,
      command: "pnpm install",
      ...overrides,
    },
  };
}

test("runtime guidance prints macOS Bun install commands when Bun is selected but missing", () => {
  const environment = createEnvironment("darwin");
  environment.packageManagers.bun = { installed: false };
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.packageManager = "bun";
  plan.targetDir = "/tmp/devforge-guidance-test/bun-app";

  const guidance = buildRuntimeGuidance(
    plan,
    environment,
    createInstallResult({
      succeeded: false,
      available: false,
      command: "bun install",
      failureReason: "bun is not installed and Corepack is unavailable; generated project without installing dependencies.",
    }),
    "/tmp",
  );

  assert.match(
    guidance.requiredBeforeRun.map((item) => `${item.title} ${item.command ?? ""}`).join("\n"),
    /Install or enable bun[\s\S]*curl -fsSL https:\/\/bun\.sh\/install \| bash/i,
  );
  assert.match(
    guidance.requiredBeforeRun.map((item) => `${item.title} ${item.command ?? ""}`).join("\n"),
    /Install project dependencies[\s\S]*bun install/i,
  );
  assert.deepEqual(guidance.nextCommands, []);
});

test("runtime guidance prints Linux-specific Playwright and custom Node setup commands", () => {
  const environment = createEnvironment("linux");
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.nodeStrategy = "custom";
  plan.customNodeVersion = "23.11.0";
  plan.testing = {
    enabled: true,
    runner: "playwright",
    environment: "browser-e2e",
    includeExampleTests: true,
  };
  plan.targetDir = "/tmp/devforge-guidance-test/playwright-app";

  const guidance = buildRuntimeGuidance(
    plan,
    environment,
    createInstallResult({ command: "pnpm install" }),
    "/tmp",
  );

  assert.match(
    guidance.requiredBeforeRun.map((item) => `${item.title} ${item.command ?? ""}`).join("\n"),
    /Switch Node\.js versions[\s\S]*nvm install 23\.11\.0 && nvm use 23\.11\.0/i,
  );
  assert.match(
    guidance.requiredBeforeRun.map((item) => `${item.title} ${item.command ?? ""}`).join("\n"),
    /Install Playwright browsers[\s\S]*npx playwright install --with-deps/i,
  );
  assert.deepEqual(guidance.nextCommands.slice(0, 2), [
    "cd /tmp/devforge-guidance-test/playwright-app",
    "pnpm run dev",
  ]);
});

test("runtime guidance prints Windows setup commands for missing Git and Docker", () => {
  const environment = createEnvironment("win32");
  environment.systemTools = {
    git: { installed: false },
    docker: { installed: false },
    corepack: { installed: true, version: "0.29.3", path: "C:\\Program Files\\nodejs\\corepack.cmd" },
  };

  const plan = buildDefaultPlan(environment, cliOptions);
  plan.git.initialize = true;
  plan.tooling.docker = true;

  const guidance = buildRuntimeGuidance(
    plan,
    environment,
    createInstallResult(),
    "/tmp/devforge-guidance-test",
  );

  assert.match(
    guidance.recommended.map((item) => `${item.title} ${item.command ?? ""}`).join("\n"),
    /Install Git[\s\S]*winget install Git\.Git/i,
  );
  assert.match(
    guidance.recommended.map((item) => `${item.title} ${item.command ?? ""}`).join("\n"),
    /Install Docker[\s\S]*winget install Docker\.DockerDesktop/i,
  );
});

test("runtime guidance falls back to npm when pnpm is selected but Corepack is unavailable", () => {
  const environment = createEnvironment("darwin");
  environment.packageManagers.pnpm = { installed: false };
  environment.systemTools = {
    git: { installed: true, version: "2.45.1", path: "/usr/bin/git" },
    docker: { installed: true, version: "27.0.0", path: "/usr/local/bin/docker" },
    corepack: { installed: false },
  };

  const plan = buildDefaultPlan(environment, cliOptions);
  plan.packageManager = "pnpm";

  const guidance = buildRuntimeGuidance(
    plan,
    environment,
    createInstallResult({
      succeeded: false,
      available: false,
      command: "pnpm install",
      failureReason: "pnpm is not installed and Corepack is unavailable; generated project without installing dependencies.",
    }),
    "/tmp",
  );

  assert.match(
    guidance.requiredBeforeRun.map((item) => `${item.title} ${item.command ?? ""}`).join("\n"),
    /Install or enable pnpm[\s\S]*npm install -g pnpm/i,
  );
});

test("template guidance carries Bun and Docker prerequisites into generated docs", () => {
  const environment = createEnvironment("darwin");
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.packageManager = "bun";
  plan.tooling.docker = true;

  const guidance = buildTemplateGuidance(plan);

  assert.match(
    guidance.requiredBeforeRun.map((item) => item.title).join("\n"),
    /Install Bun on each machine/i,
  );
  assert.match(
    guidance.recommended.map((item) => item.title).join("\n"),
    /Install Docker before using container workflows/i,
  );
});
