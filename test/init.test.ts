import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runInitCommand } from "../src/commands/init.js";
import type { CliOptions } from "../src/types.js";
import { pathExists } from "../src/utils/fs.js";

test("init can save the default devforge.config.json path without blocking project generation", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "devforge-init-save-config-"));
  const previousCwd = process.cwd();

  try {
    process.chdir(workspace);

    const options: CliOptions = {
      command: "init",
      resume: false,
      skipInstall: true,
      saveConfig: true,
      yes: true,
      outputDir: "generated-app",
      projectName: "generated-app",
    };

    await runInitCommand(options);

    const targetDir = join(workspace, "generated-app");
    const configPath = join(targetDir, "devforge.config.json");
    const planPath = join(targetDir, ".devforge", "project-plan.json");

    assert.equal(await pathExists(configPath), true);
    assert.equal(await pathExists(planPath), true);

    const savedConfig = JSON.parse(await readFile(configPath, "utf8")) as {
      targetDir?: string;
      projectName: string;
      schemaVersion: number;
    };

    assert.equal(savedConfig.projectName, "generated-app");
    assert.equal(savedConfig.schemaVersion, 1);
    assert.equal("targetDir" in savedConfig, false);
  } finally {
    process.chdir(previousCwd);
  }
});
