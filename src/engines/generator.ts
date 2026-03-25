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
  isDirectoryEmpty,
  pathExists,
  writeGeneratedFiles,
  writeJson,
} from "../utils/fs.js";

export async function generateProject(
  plan: ProjectPlan,
  environment: EnvironmentInfo,
): Promise<GeneratedProjectResult> {
  const projectExists = await pathExists(plan.targetDir);

  if (projectExists && !(await isDirectoryEmpty(plan.targetDir))) {
    throw new Error(
      `Target directory is not empty: ${plan.targetDir}. Choose a new directory or clear it first.`,
    );
  }

  await ensureDir(plan.targetDir);

  const files = [...buildProjectFiles(plan, environment), ...buildAiRuleFiles(plan)];
  const filesWritten = await writeGeneratedFiles(plan.targetDir, files);

  await writeJson(join(plan.targetDir, ".devforge", "project-plan.json"), plan);

  return {
    targetDir: plan.targetDir,
    filesWritten,
    notes: [],
  };
}
