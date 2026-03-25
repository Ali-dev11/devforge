import { dirname, join } from "node:path";
import { detectEnvironment } from "../engines/environment.js";
import { generateProject } from "../engines/generator.js";
import { runInstallers } from "../engines/installer.js";
import { normalizeProjectPlan } from "../engines/decision.js";
import { buildDefaultPlan, collectProjectPlan } from "../engines/prompts.js";
import type { CliOptions, ResumeState } from "../types.js";
import { RESUME_STATE_PATH } from "../constants.js";
import {
  ensureDir,
  pathExists,
  readJson,
  removeFile,
  saveResumeState,
} from "../utils/fs.js";
import {
  banner,
  createProgressReporter,
  info,
  step,
  success,
  warn,
} from "../utils/logger.js";

async function loadResumePlan(): Promise<ResumeState | undefined> {
  const resumePath = join(process.cwd(), RESUME_STATE_PATH);

  if (!(await pathExists(resumePath))) {
    return undefined;
  }

  return readJson<ResumeState>(resumePath);
}

async function persistResume(plan: ResumeState["plan"]): Promise<void> {
  const resumePath = join(process.cwd(), RESUME_STATE_PATH);
  await ensureDir(dirname(resumePath));
  await saveResumeState(resumePath, {
    updatedAt: new Date().toISOString(),
    plan,
  });
}

async function clearResume(): Promise<void> {
  await removeFile(join(process.cwd(), RESUME_STATE_PATH));
}

export async function runInitCommand(options: CliOptions): Promise<void> {
  const environment = detectEnvironment();
  const resumeState = options.resume ? await loadResumePlan() : undefined;

  if (options.resume && !resumeState) {
    throw new Error("No saved DevForge resume state was found in the current directory.");
  }

  banner("DevForge CLI");
  info(`Platform: ${environment.platform}/${environment.arch}`);
  info(`Node.js: ${environment.nodeVersion}`);
  step(`Package manager preference: ${environment.recommendedPackageManager}`);

  const seed = resumeState?.plan ?? buildDefaultPlan(environment, options);
  const collectedPlan = await collectProjectPlan(environment, options, seed);
  await persistResume(collectedPlan);

  const { plan, warnings } = normalizeProjectPlan(collectedPlan, environment);

  if (warnings.length > 0) {
    for (const warning of warnings) {
      warn(warning);
    }
  }

  step(`Generating project in ${plan.targetDir}`);
  const progressReporter = createProgressReporter("Writing files");
  const generated = await generateProject(plan, environment, {
    onWrite: ({ current, total }) => {
      progressReporter({ current, total });
    },
  });

  const installResult = runInstallers(plan, environment, options.skipInstall);

  if (plan.git.setupSsh) {
    warn("SSH setup was requested; DevForge generated guidance in the README instead of editing system SSH config.");
  }

  await clearResume();

  success("\nYour project is ready.");
  step(`Files written: ${generated.filesWritten.length}`);

  if (installResult.executed.length > 0) {
    step(`Executed: ${installResult.executed.join(", ")}`);
  }

  if (installResult.skipped.length > 0) {
    for (const reason of installResult.skipped) {
      warn(reason);
    }
  }
}
