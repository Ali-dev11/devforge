import test from "node:test";
import assert from "node:assert/strict";
import { buildDefaultPlan } from "../src/engines/prompts.js";
import { buildAiRuleFiles } from "../src/engines/ai-rules.js";
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
  outputDir: "/tmp/devforge-ai-test",
  projectName: "devforge-ai-test",
};

test("AI rules include curated DevForge rule references", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.frontend = {
    framework: "react-vite",
    rendering: "client",
    styling: "tailwind-css",
    uiLibrary: "shadcn-ui",
    state: "redux-toolkit",
    dataFetching: "tanstack-query",
  };
  plan.testing = {
    enabled: true,
    runner: "vitest",
    environment: "jsdom",
    includeExampleTests: true,
  };

  const files = buildAiRuleFiles(plan);
  const agentsFile = files.find((file) => file.path === "AGENTS.md");
  const sourcesFile = files.find((file) => file.path === "docs/ai-rules-sources.md");

  assert.ok(agentsFile);
  assert.ok(sourcesFile);
  assert.match(agentsFile.content, /Recommended Rule Packs/);
  assert.match(sourcesFile.content, /React \(Redux, TypeScript\)/);
  assert.match(sourcesFile.content, /Vitest Unit Testing/);
});
