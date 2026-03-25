#!/usr/bin/env node
import { runRuntimeMatrix } from "../runtime-matrix.js";

runRuntimeMatrix().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
