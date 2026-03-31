import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDefaultPlan } from "../src/engines/prompts.js";
import {
  buildDoctorPreflightReport,
  buildPlanPreflightReport,
} from "../src/preflight.js";
import type { CliOptions, EnvironmentInfo } from "../src/types.js";

const cliOptions: CliOptions = {
  command: "init",
  resume: false,
  skipInstall: true,
  yes: true,
  outputDir: "/tmp/devforge-preflight-test",
  projectName: "devforge-preflight-test",
};

function createEnvironment(platform: NodeJS.Platform = "darwin"): EnvironmentInfo {
  return {
    platform,
    arch: platform === "win32" ? "x64" : "arm64",
    nodeVersion: "v22.0.0",
    recommendedPackageManager: "pnpm",
    packageManagers: {
      npm: { installed: true, version: "10.5.1", path: "/usr/bin/npm" },
      pnpm: { installed: true, version: "9.0.0", path: "/usr/local/bin/pnpm" },
      yarn: { installed: true, version: "4.1.0", path: "/usr/local/bin/yarn" },
      bun: { installed: true, version: "1.3.11", path: "/usr/local/bin/bun" },
    },
    systemTools: {
      git: { installed: true, version: "2.45.1", path: "/usr/bin/git" },
      docker: { installed: true, version: "27.0.0", path: "/usr/local/bin/docker" },
      corepack: { installed: true, version: "0.29.3", path: "/usr/local/bin/corepack" },
      fnm: { installed: true, version: "1.37.1", path: "/usr/local/bin/fnm" },
      ssh: { installed: true, version: "OpenSSH_9.8", path: "/usr/bin/ssh" },
    },
  };
}

test("plan preflight flags unsupported Node versions and missing package managers as blockers", () => {
  const environment = createEnvironment("darwin");
  environment.packageManagers.bun = { installed: false };
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.packageManager = "bun";

  const report = buildPlanPreflightReport(plan, environment);

  assert.equal(report.hasBlockingIssues, true);
  assert.match(
    report.requiredBeforeRun.map((item) => `${item.title} ${item.command ?? ""}`).join("\n"),
    /Use a compatible Node\.js version[\s\S]*fnm install 22\.12\.0 && fnm use 22\.12\.0/i,
  );
  assert.match(
    report.requiredBeforeRun.map((item) => `${item.title} ${item.command ?? ""}`).join("\n"),
    /Install or enable bun[\s\S]*curl -fsSL https:\/\/bun\.sh\/install \| bash/i,
  );
});

test("plan preflight recommends Playwright, Docker, and SSH follow-up steps when selected", async () => {
  const environment = createEnvironment("linux");
  environment.nodeVersion = "v22.12.0";
  environment.systemTools = {
    git: { installed: false },
    docker: { installed: false },
    corepack: { installed: true, version: "0.29.3", path: "/usr/local/bin/corepack" },
    fnm: { installed: true, version: "1.37.1", path: "/usr/local/bin/fnm" },
    ssh: { installed: false },
  };

  const homeDir = await mkdtemp(join(tmpdir(), "devforge-preflight-home-"));
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.testing = {
    enabled: true,
    runner: "playwright",
    environment: "browser-e2e",
    includeExampleTests: true,
  };
  plan.tooling.docker = true;
  plan.git.setupSsh = true;
  plan.git.initialize = true;

  const report = buildPlanPreflightReport(plan, environment, {
    homeDir,
    processEnv: { PLAYWRIGHT_BROWSERS_PATH: join(homeDir, "pw") },
  });

  const recommended = report.recommended.map((item) => `${item.title} ${item.command ?? ""}`).join("\n");

  assert.match(recommended, /Install Playwright browsers[\s\S]*npx playwright install --with-deps/i);
  assert.match(recommended, /Install Git[\s\S]*sudo apt-get update && sudo apt-get install -y git/i);
  assert.match(recommended, /Install Docker[\s\S]*curl -fsSL https:\/\/get\.docker\.com \| sh/i);
  assert.match(recommended, /Install an SSH client[\s\S]*openssh-client/i);
  assert.match(recommended, /Generate an SSH key[\s\S]*ssh-keygen -t ed25519/i);
});

test("doctor report surfaces missing machine prerequisites and detects ready ones", async () => {
  const environment = createEnvironment("darwin");
  environment.nodeVersion = "v22.12.0";
  environment.packageManagers.bun = { installed: false };
  environment.systemTools = {
    git: { installed: true, version: "2.45.1", path: "/usr/bin/git" },
    docker: { installed: false },
    corepack: { installed: false },
    fnm: { installed: true, version: "1.37.1", path: "/usr/local/bin/fnm" },
    ssh: { installed: false },
  };

  const homeDir = await mkdtemp(join(tmpdir(), "devforge-doctor-home-"));
  const sshDir = join(homeDir, ".ssh");
  const browsersDir = join(homeDir, "Library", "Caches", "ms-playwright");
  await mkdir(sshDir, { recursive: true });
  await mkdir(browsersDir, { recursive: true });
  await writeFile(join(sshDir, "id_ed25519.pub"), "ssh-ed25519 AAAA test@example.com\n");
  await writeFile(join(browsersDir, "chromium-1208"), "");

  const report = buildDoctorPreflightReport(environment, { homeDir });
  const healthy = report.healthy.map((item) => item.title).join("\n");
  const recommended = report.recommended.map((item) => `${item.title} ${item.command ?? ""}`).join("\n");

  assert.equal(report.hasBlockingIssues, false);
  assert.match(healthy, /Node\.js is ready for frontend and extension scaffolds/i);
  assert.match(healthy, /An SSH public key is present/i);
  assert.match(healthy, /Playwright browsers are installed/i);
  assert.match(recommended, /Enable Corepack for pnpm and Yarn flows[\s\S]*corepack enable/i);
  assert.match(recommended, /Install Bun for Bun-based scaffolds[\s\S]*bun\.sh\/install/i);
  assert.match(recommended, /Install Docker for container workflows[\s\S]*brew install --cask docker/i);
  assert.match(recommended, /Install an SSH client[\s\S]*xcode-select --install/i);
});
