import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

function run(command, args, cwd, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "inherit",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}

const rootDir = process.cwd();
const workspace = mkdtempSync(join(tmpdir(), "devforge-packed-smoke-"));
const packDir = join(workspace, "pack");
const installDir = join(workspace, "install");
const outputDir = join(workspace, "output");
const npmCacheDir = join(workspace, "npm-cache");

mkdirSync(packDir, { recursive: true });
mkdirSync(installDir, { recursive: true });

try {
  run(
    "npm",
    ["pack", "--ignore-scripts", "--pack-destination", packDir],
    rootDir,
    {
      npm_config_cache: npmCacheDir,
    },
  );

  const tarball = readdirSync(packDir)
    .find((entry) => entry.endsWith(".tgz"));

  if (!tarball) {
    throw new Error("Could not find the packed DevForge tarball.");
  }

  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--prefix",
      installDir,
      resolve(packDir, tarball),
    ],
    rootDir,
    {
      npm_config_cache: npmCacheDir,
    },
  );

  run(
    "node",
    [
      resolve(installDir, "node_modules/@ali-dev11/devforge/dist/bin/devforge.js"),
      "init",
      "--yes",
      "--skip-install",
      "--output",
      outputDir,
    ],
    rootDir,
  );

  run(
    "node",
    [
      resolve(installDir, "node_modules/@ali-dev11/devforge/dist/bin/devforge.js"),
      "add",
      "docker",
    ],
    outputDir,
  );

  if (!existsSync(resolve(outputDir, "Dockerfile"))) {
    throw new Error("Packed smoke run did not create Dockerfile after `devforge add docker`.");
  }
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
