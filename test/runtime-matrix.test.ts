import test from "node:test";
import assert from "node:assert/strict";
import {
  expectedBackendFrameworkCoverage,
  expectedIntentCoverage,
  runtimeScenarioCoverage,
  runtimeScenarios,
} from "../src/runtime-matrix.js";

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
