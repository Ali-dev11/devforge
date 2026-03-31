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

test("cli rejects init-only flags on doctor", () => {
  assert.throws(
    () => parseArgs(["doctor", "--skip-install"]),
    /--skip-install can only be used with `devforge init`/i,
  );
});
