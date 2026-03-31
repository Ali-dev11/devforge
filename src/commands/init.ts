import { dirname, join } from "node:path";
import {
  defaultConfigOutputPath,
  readProjectPlanConfig,
  resolveConfigPath,
  writeProjectPlanConfig,
} from "../config.js";
import { buildRuntimeGuidance } from "../guidance.js";
import { detectEnvironment } from "../engines/environment.js";
import { generateProject } from "../engines/generator.js";
import { runInstallers } from "../engines/installer.js";
import { normalizeProjectPlan } from "../engines/decision.js";
import { buildDefaultPlan, collectProjectPlan } from "../engines/prompts.js";
import {
  buildPlanPreflightReport,
  hasVisiblePreflightOutput,
  printPreflightReport,
} from "../preflight.js";
import type { AdvisoryItem, CliOptions, ResumeState } from "../types.js";
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

function printAdvisorySection(
  title: string,
  items: AdvisoryItem[],
  options?: { warnItems?: boolean },
): void {
  if (items.length === 0) {
    return;
  }

  info("");
  step(`${title}:`);

  for (const item of items) {
    const log = options?.warnItems ? warn : info;
    log(`  ${item.title}: ${item.detail}`);
    if (item.command) {
      info(`    ${item.command}`);
    }
  }
}

function printNextCommands(commands: string[]): void {
  if (commands.length === 0) {
    return;
  }

  info("");
  step("Next commands:");
  for (const command of commands) {
    info(`    ${command}`);
  }
}

function printStackNotes(notes: string[]): void {
  if (notes.length === 0) {
    return;
  }

  info("");
  step("Stack notes:");
  for (const note of notes) {
    info(`  - ${note}`);
  }
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

  const collectedPlan = options.configPath
    ? await readProjectPlanConfig(options.configPath, environment, options)
    : await collectProjectPlan(
        environment,
        options,
        resumeState?.plan ?? buildDefaultPlan(environment, options),
      );

  if (options.configPath) {
    step(`Loaded config from ${resolveConfigPath(options.configPath)}`);
  } else {
    await persistResume(collectedPlan);
  }

  const { plan, warnings } = normalizeProjectPlan(collectedPlan, environment);

  if (warnings.length > 0) {
    for (const warning of warnings) {
      warn(warning);
    }
  }

  const saveConfigPath = options.saveConfig
    ? options.saveConfigPath
      ? resolveConfigPath(options.saveConfigPath)
      : defaultConfigOutputPath(plan.targetDir)
    : undefined;

  if (saveConfigPath) {
    await writeProjectPlanConfig(saveConfigPath, plan);
    step(`Saved normalized config to ${saveConfigPath}`);
  }

  const preflightReport = buildPlanPreflightReport(plan, environment);

  if (options.preflightOnly) {
    printPreflightReport(preflightReport, { showHealthy: true });

    if (preflightReport.hasBlockingIssues) {
      warn("Preflight found blocking issues. Fix them, then rerun `devforge init --resume` to continue.");
      process.exitCode = 1;
      return;
    }

    success("\nPreflight completed. Rerun `devforge init --resume` to generate the project with the same saved plan.");
    return;
  }

  if (hasVisiblePreflightOutput(preflightReport)) {
    printPreflightReport(preflightReport);

    if (preflightReport.hasBlockingIssues) {
      warn("Preflight found blocking issues. DevForge will still write the scaffold, but dependency installation may be skipped until you fix the items above.");
    }
  }

  step(`Generating project in ${plan.targetDir}`);
  const progressReporter = createProgressReporter("Writing files");
  const generated = await generateProject(plan, environment, {
    onWrite: ({ current, total }) => {
      progressReporter({ current, total });
    },
  });

  const installResult = runInstallers(plan, environment, options.skipInstall, {
    onStep(message) {
      step(message);
    },
  });

  if (plan.git.setupSsh) {
    warn("SSH setup was requested; DevForge generated guidance in the README instead of editing system SSH config.");
  }

  await clearResume();
  const guidance = buildRuntimeGuidance(plan, environment, installResult, process.cwd());

  success(`\n${installResult.dependencyInstall.succeeded ? "Your project is ready." : "Your project files are ready."}`);
  step(`Files written: ${generated.filesWritten.length}`);

  if (installResult.executed.length > 0) {
    step(`Executed: ${installResult.executed.join(", ")}`);
  }

  if (installResult.skipped.length > 0) {
    for (const reason of installResult.skipped) {
      warn(reason);
    }
  }

  printAdvisorySection("Required before run", guidance.requiredBeforeRun, {
    warnItems: true,
  });
  printNextCommands(guidance.nextCommands);
  printAdvisorySection("Recommended", guidance.recommended);
  printStackNotes(guidance.stackNotes);
}
