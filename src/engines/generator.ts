import { join } from "node:path";
import { buildAiRuleFiles } from "./ai-rules.js";
import { buildProjectFiles } from "../templates.js";
import type {
  EnvironmentInfo,
  GeneratedProjectResult,
  ProjectPlan,
} from "../types.js";
import {
  ensureDir,
  isDirectory,
  isDirectoryEmpty,
  pathExists,
  writeGeneratedFiles,
  writeJson,
} from "../utils/fs.js";

type GenerateProjectOptions = {
  onWrite?: (info: { current: number; total: number; path: string }) => void;
};

export async function generateProject(
  plan: ProjectPlan,
  environment: EnvironmentInfo,
  options?: GenerateProjectOptions,
): Promise<GeneratedProjectResult> {
  const projectExists = await pathExists(plan.targetDir);

  if (projectExists && !(await isDirectory(plan.targetDir))) {
    throw new Error(
      `Target path is not a directory: ${plan.targetDir}. Choose a new directory path instead.`,
    );
  }

  if (projectExists && !(await isDirectoryEmpty(plan.targetDir))) {
    throw new Error(
      `Target directory is not empty: ${plan.targetDir}. Choose a new directory or clear it first.`,
    );
  }

  await ensureDir(plan.targetDir);

  const files = [...buildProjectFiles(plan, environment), ...buildAiRuleFiles(plan)];
  const totalWrites = files.length + 1;
  const filesWritten = await writeGeneratedFiles(plan.targetDir, files, options?.onWrite
    ? ({ current, path }) => {
        options.onWrite?.({ current, total: totalWrites, path });
      }
    : undefined);

  await writeJson(join(plan.targetDir, ".devforge", "project-plan.json"), plan);
  options?.onWrite?.({
    current: totalWrites,
    total: totalWrites,
    path: join(plan.targetDir, ".devforge", "project-plan.json"),
  });

  return {
    targetDir: plan.targetDir,
    filesWritten,
    notes: [],
  };
}
