import test from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import { readCommandOutput } from "../src/engines/environment.js";

test("readCommandOutput returns stdout for fast commands", () => {
  const output = readCommandOutput(
    process.execPath,
    ["-e", "console.log('devforge-env-ok')"],
    { timeoutMs: 250 },
  );

  assert.equal(output, "devforge-env-ok");
});

test("readCommandOutput returns undefined when a version probe times out", () => {
  const startedAt = Date.now();
  const output = readCommandOutput(
    process.execPath,
    ["-e", "setTimeout(() => {}, 5000)"],
    { timeoutMs: 50 },
  );

  assert.equal(output, undefined);
  assert.ok(Date.now() - startedAt < 2_000);
});
