import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDefaultPlan, applyIntentDefaults } from "../src/engines/prompts.js";
import { runInstallers } from "../src/engines/installer.js";
import type { CliOptions, EnvironmentInfo } from "../src/types.js";

const environment: EnvironmentInfo = {
  platform: "darwin",
  arch: "arm64",
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
    fnm: { installed: true, version: "1.37.1", path: "/usr/local/bin/fnm" },
  },
};

const cliOptions: CliOptions = {
  command: "init",
  resume: false,
  skipInstall: true,
  yes: true,
  outputDir: "/tmp/devforge-installer-test",
  projectName: "devforge-installer-test",
};

test("installer skips dependency installation when the current Node.js version is unsupported", async () => {
  const targetDir = await mkdtemp(join(tmpdir(), "devforge-installer-"));
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.intent = "chrome-extension";
  plan.targetDir = targetDir;
  applyIntentDefaults(plan);

  const result = runInstallers(plan, environment, false);

  assert.equal(result.executed.includes("corepack pnpm install"), false);
  assert.equal(result.dependencyInstall.attempted, false);
  assert.equal(result.dependencyInstall.succeeded, false);
  assert.equal(result.dependencyInstall.skipped, true);
  assert.match(
    result.dependencyInstall.failureReason ?? "",
    /Current Node\.js v22\.0\.0 does not satisfy this scaffold/i,
  );
});
