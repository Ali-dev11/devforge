import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../src/cli.js";

test("cli parses the doctor command", () => {
  const options = parseArgs(["doctor"]);

  assert.equal(options.command, "doctor");
  assert.equal(options.preflightOnly, false);
});

test("cli parses init preflight mode", () => {
  const options = parseArgs(["init", "--preflight-only", "--yes"]);

  assert.equal(options.command, "init");
  assert.equal(options.preflightOnly, true);
  assert.equal(options.yes, true);
});

test("cli parses add command with a feature and skip-install", () => {
  const options = parseArgs(["add", "docker", "--skip-install"]);

  assert.equal(options.command, "add");
  assert.equal(options.addFeature, "docker");
  assert.equal(options.skipInstall, true);
});

test("cli treats add --help as help output", () => {
  const options = parseArgs(["add", "--help"]);

  assert.equal(options.command, "help");
});

test("cli parses config-driven init and optional save-config path", () => {
  const options = parseArgs([
    "init",
    "--config",
    "./devforge.config.json",
    "--save-config",
    "./saved/devforge.config.json",
  ]);

  assert.equal(options.command, "init");
  assert.equal(options.configPath, "./devforge.config.json");
  assert.equal(options.saveConfig, true);
  assert.equal(options.saveConfigPath, "./saved/devforge.config.json");
});

test("cli parses init preset selection", () => {
  const options = parseArgs(["init", "--preset", "frontend-app", "--yes"]);

  assert.equal(options.command, "init");
  assert.equal(options.preset, "frontend-app");
  assert.equal(options.yes, true);
});

test("cli parses upgrade with skip-install", () => {
  const options = parseArgs(["upgrade", "--skip-install"]);

  assert.equal(options.command, "upgrade");
  assert.equal(options.skipInstall, true);
});

test("cli rejects init-only flags on doctor", () => {
  assert.throws(
    () => parseArgs(["doctor", "--skip-install"]),
    /--skip-install can only be used with `devforge init`, `devforge add`, or `devforge upgrade`/i,
  );
});

test("cli rejects config and resume together", () => {
  assert.throws(
    () => parseArgs(["init", "--resume", "--config", "./devforge.config.json"]),
    /--resume.*--config/i,
  );
});

test("cli rejects preset and config together", () => {
  assert.throws(
    () => parseArgs(["init", "--preset", "frontend-app", "--config", "./devforge.config.json"]),
    /--config.*--preset/i,
  );
});

test("cli requires a feature name for add", () => {
  assert.throws(
    () => parseArgs(["add"]),
    /Missing feature for `devforge add`/i,
  );
});
