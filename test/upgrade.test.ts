import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyUpgrade } from "../src/commands/upgrade.js";
import { PROJECT_PLAN_PATH } from "../src/constants.js";
import { generateProject } from "../src/engines/generator.js";
import { buildDefaultPlan } from "../src/engines/prompts.js";
import type { CliOptions, EnvironmentInfo, ProjectPlan } from "../src/types.js";

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
  outputDir: "/tmp/devforge-upgrade-test",
  projectName: "devforge-upgrade-test",
};

test("upgrade rejects directories that are not recognized DevForge projects", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "devforge-upgrade-non-project-"));

  await assert.rejects(
    () => applyUpgrade(tempDir, environment, { skipInstall: true }),
    /does not look like a DevForge project/i,
  );
});

test("upgrade applies deployment-aware managed files from the stored project plan", async () => {
  const targetDir = await mkdtemp(join(tmpdir(), "devforge-upgrade-deploy-"));
  const plan = buildDefaultPlan(environment, {
    ...cliOptions,
    outputDir: targetDir,
    projectName: "devforge-upgrade-deploy",
  });
  plan.targetDir = targetDir;

  await generateProject(plan, environment);

  const storedPlanPath = join(targetDir, PROJECT_PLAN_PATH);
  const storedPlan = JSON.parse(await readFile(storedPlanPath, "utf8")) as ProjectPlan;
  storedPlan.deployment.target = "vercel";
  await writeFile(storedPlanPath, `${JSON.stringify(storedPlan, null, 2)}\n`, "utf8");

  const result = await applyUpgrade(targetDir, environment, { skipInstall: true });
  const vercelConfig = await readFile(join(targetDir, "vercel.json"), "utf8");
  const deployWorkflow = await readFile(join(targetDir, ".github/workflows/deploy.yml"), "utf8");

  assert.equal(result.plan.deployment.target, "vercel");
  assert.match(vercelConfig, /outputDirectory/);
  assert.match(deployWorkflow, /vercel deploy --prebuilt --prod/);
});

test("upgrade removes obsolete managed deployment files when the target changes", async () => {
  const targetDir = await mkdtemp(join(tmpdir(), "devforge-upgrade-deployment-switch-"));
  const plan = buildDefaultPlan(environment, {
    ...cliOptions,
    outputDir: targetDir,
    projectName: "devforge-upgrade-deployment-switch",
  });
  plan.targetDir = targetDir;
  plan.deployment.target = "vercel";
  plan.tooling.githubActions = true;

  await generateProject(plan, environment);

  const storedPlanPath = join(targetDir, PROJECT_PLAN_PATH);
  const storedPlan = JSON.parse(await readFile(storedPlanPath, "utf8")) as ProjectPlan;
  storedPlan.deployment.target = "render";
  await writeFile(storedPlanPath, `${JSON.stringify(storedPlan, null, 2)}\n`, "utf8");

  await applyUpgrade(targetDir, environment, { skipInstall: true });

  await assert.rejects(
    () => readFile(join(targetDir, "vercel.json"), "utf8"),
    /ENOENT/,
  );
  const renderYaml = await readFile(join(targetDir, "render.yaml"), "utf8");
  assert.match(renderYaml, /runtime: static/);
});

test("upgrade skips managed files that users have modified away from the generated baseline", async () => {
  const targetDir = await mkdtemp(join(tmpdir(), "devforge-upgrade-skip-custom-"));
  const plan = buildDefaultPlan(environment, {
    ...cliOptions,
    outputDir: targetDir,
    projectName: "devforge-upgrade-skip-custom",
  });
  plan.targetDir = targetDir;

  await generateProject(plan, environment);
  await writeFile(join(targetDir, "README.md"), "# Custom README\n", "utf8");

  const result = await applyUpgrade(targetDir, environment, { skipInstall: true });
  const readme = await readFile(join(targetDir, "README.md"), "utf8");

  assert.match(result.skippedManaged.join(" "), /README\.md/);
  assert.equal(readme, "# Custom README\n");
});

test("upgrade rejects unsupported DevForge project metadata versions", async () => {
  const targetDir = await mkdtemp(join(tmpdir(), "devforge-upgrade-schema-version-"));
  const plan = buildDefaultPlan(environment, {
    ...cliOptions,
    outputDir: targetDir,
    projectName: "devforge-upgrade-schema-version",
  });
  plan.targetDir = targetDir;

  await generateProject(plan, environment);

  const storedPlanPath = join(targetDir, PROJECT_PLAN_PATH);
  const storedPlan = JSON.parse(await readFile(storedPlanPath, "utf8")) as ProjectPlan;
  storedPlan.schemaVersion = 2;
  await writeFile(storedPlanPath, `${JSON.stringify(storedPlan, null, 2)}\n`, "utf8");

  await assert.rejects(
    () => applyUpgrade(targetDir, environment, { skipInstall: true }),
    /Unsupported DevForge project metadata version/i,
  );
});

test("upgrade reports missing dependencies instead of a generic no-op warning", async () => {
  const targetDir = await mkdtemp(join(tmpdir(), "devforge-upgrade-missing-deps-"));
  const plan = buildDefaultPlan(environment, {
    ...cliOptions,
    outputDir: targetDir,
    projectName: "devforge-upgrade-missing-deps",
  });
  plan.targetDir = targetDir;

  await generateProject(plan, environment);

  const result = await applyUpgrade(targetDir, environment, { skipInstall: true });
  const skippedText = result.installResult.skipped.join(" ");

  assert.doesNotMatch(
    skippedText,
    /refreshed managed files without changing package manifests/i,
  );
  assert.match(skippedText, /do not appear to be installed/i);
});
