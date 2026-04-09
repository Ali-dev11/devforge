import test from "node:test";
import assert from "node:assert/strict";
import {
  expectedBackendFrameworkCoverage,
  expectedIntentCoverage,
  installCommandForPackageManager,
  runtimeScriptInvocation,
  runtimeScenarioCoverage,
  runtimeScenarios,
} from "../src/runtime-matrix.js";

const environmentWithoutPnpm = {
  platform: "linux",
  arch: "x64",
  nodeVersion: "v22.12.0",
  recommendedPackageManager: "pnpm",
  packageManagers: {
    npm: { installed: true, version: "10.9.0", path: "/usr/bin/npm" },
    pnpm: { installed: false },
    yarn: { installed: false },
    bun: { installed: false },
  },
  systemTools: {
    git: { installed: true, version: "2.45.0", path: "/usr/bin/git" },
    docker: { installed: true, version: "27.0.0", path: "/usr/bin/docker" },
    corepack: { installed: true, version: "0.29.4", path: "/usr/bin/corepack" },
    fnm: { installed: true, version: "1.37.1", path: "/usr/bin/fnm" },
  },
} as const;

test("runtime matrix covers every primary project intent", () => {
  const coverage = runtimeScenarioCoverage();

  assert.deepEqual(coverage.intents, expectedIntentCoverage().sort());
});

test("runtime matrix covers every backend framework runtime surface", () => {
  const coverage = runtimeScenarioCoverage();

  assert.deepEqual(coverage.backendFrameworks, expectedBackendFrameworkCoverage().sort());
});

test("runtime scenarios are uniquely named", () => {
  const names = runtimeScenarios.map((scenario) => scenario.name);

  assert.equal(new Set(names).size, names.length);
});

test("runtime matrix includes the Bun and Remix verification path", () => {
  const remixScenario = runtimeScenarios.find((scenario) => scenario.name === "frontend-remix-bun");

  assert.ok(remixScenario);
  assert.equal(remixScenario.intent, "frontend-app");
  assert.equal(remixScenario.frontendFramework, "remix");
});

test("runtime matrix includes deployment-target verification paths", () => {
  assert.ok(
    runtimeScenarios.find((scenario) => scenario.name === "frontend-nextjs"),
  );
  assert.ok(
    runtimeScenarios.find((scenario) => scenario.name === "frontend-nextjs-railway"),
  );
  assert.ok(
    runtimeScenarios.find((scenario) => scenario.name === "frontend-react-vite-netlify"),
  );
  assert.ok(
    runtimeScenarios.find((scenario) => scenario.name === "backend-fastify"),
  );
  assert.ok(
    runtimeScenarios.find((scenario) => scenario.name === "backend-fastify-render"),
  );
  assert.ok(
    runtimeScenarios.find((scenario) => scenario.name === "backend-nestjs-enterprise-pnpm"),
  );
  assert.ok(
    runtimeScenarios.find((scenario) => scenario.name === "chrome-extension-react-jest-pnpm"),
  );
});

test("runtime matrix uses npm-backed pnpm install fallback when pnpm is not installed", () => {
  const invocation = installCommandForPackageManager(environmentWithoutPnpm, "pnpm");

  assert.equal(invocation.command, "npx");
  assert.deepEqual(invocation.args, ["--yes", "pnpm@9", "install"]);
});

test("runtime matrix uses npm-backed pnpm script fallback when pnpm is not installed", () => {
  const invocation = runtimeScriptInvocation(environmentWithoutPnpm, "pnpm", "test");

  assert.equal(invocation.command, "npx");
  assert.deepEqual(invocation.args, ["--yes", "pnpm@9", "run", "test"]);
});
