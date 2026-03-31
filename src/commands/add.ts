import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PROJECT_PLAN_PATH } from "../constants.js";
import { buildRuntimeGuidance } from "../guidance.js";
import { buildAiRuleFiles } from "../engines/ai-rules.js";
import { normalizeProjectPlan } from "../engines/decision.js";
import { detectEnvironment } from "../engines/environment.js";
import { runInstallers } from "../engines/installer.js";
import { buildProjectFiles } from "../templates.js";
import type {
  AddFeature,
  AdvisoryItem,
  CliOptions,
  EnvironmentInfo,
  GeneratedFile,
  InstallResult,
  ProjectPlan,
  TestingConfig,
} from "../types.js";
import {
  pathExists,
  readJson,
  writeJson,
  writeTextFile,
} from "../utils/fs.js";
import {
  banner,
  info,
  step,
  success,
  warn,
} from "../utils/logger.js";

export type ApplyAddFeatureOptions = {
  skipInstall?: boolean;
  onStep?: (message: string) => void;
};

export type ApplyAddFeatureResult = {
  plan: ProjectPlan;
  warnings: string[];
  filesWritten: string[];
  featureAlreadyConfigured: boolean;
  installResult: InstallResult;
};

type PackageJsonShape = {
  packageManager?: string;
  pnpm?: Record<string, unknown>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
};

const ADD_FEATURES: AddFeature[] = ["testing", "docker", "github-actions", "ai-rules"];

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

function defaultTestingConfigForPlan(plan: ProjectPlan): TestingConfig {
  if (plan.intent === "backend-api" || plan.intent === "cli-tool") {
    return {
      enabled: true,
      runner: "jest",
      environment: "node",
      includeExampleTests: true,
    };
  }

  return {
    enabled: true,
    runner: "vitest",
    environment: "jsdom",
    includeExampleTests: true,
  };
}

function clonePlan(plan: ProjectPlan): ProjectPlan {
  return JSON.parse(JSON.stringify(plan)) as ProjectPlan;
}

function getFeatureLabel(feature: AddFeature): string {
  switch (feature) {
    case "github-actions":
      return "GitHub Actions";
    case "ai-rules":
      return "AI rules";
    case "docker":
      return "Docker";
    case "testing":
    default:
      return "testing";
  }
}

function isFeatureConfigured(plan: ProjectPlan, feature: AddFeature): boolean {
  switch (feature) {
    case "testing":
      return plan.testing.enabled;
    case "docker":
      return plan.tooling.docker;
    case "github-actions":
      return plan.tooling.githubActions;
    case "ai-rules":
      return plan.ai.tools.length > 0;
    default:
      return false;
  }
}

function ensureFeatureEnabled(plan: ProjectPlan, feature: AddFeature): void {
  switch (feature) {
    case "testing":
      if (!plan.testing.enabled) {
        plan.testing = defaultTestingConfigForPlan(plan);
      }
      break;
    case "docker":
      plan.tooling.docker = true;
      break;
    case "github-actions":
      plan.tooling.githubActions = true;
      break;
    case "ai-rules":
      if (plan.ai.tools.length === 0) {
        plan.ai.tools = ["cursor", "claude", "codex"];
      }
      break;
    default:
      break;
  }
}

function buildGeneratedFileMap(
  plan: ProjectPlan,
  environment: EnvironmentInfo,
): Map<string, GeneratedFile> {
  const files = [...buildProjectFiles(plan, environment), ...buildAiRuleFiles(plan)];
  return new Map(files.map((file) => [file.path, file]));
}

function shouldManagePathForFeature(path: string, feature: AddFeature): boolean {
  switch (feature) {
    case "testing":
      return (
        path === "docs/architecture.md" ||
        path === "docs/getting-started.md" ||
        /(^|\/)package\.json$/.test(path) ||
        /(^|\/)vitest\.config\.ts$/.test(path) ||
        /(^|\/)jest\.config\.cjs$/.test(path) ||
        /(^|\/)playwright\.config\.ts$/.test(path) ||
        /(^|\/)cypress\.config\.ts$/.test(path) ||
        path.startsWith("tests/") ||
        path.includes("/tests/") ||
        path.includes("/__tests__/") ||
        path.startsWith("cypress/") ||
        path.includes("/cypress/")
      );
    case "docker":
      return (
        path === "Dockerfile" ||
        path === ".dockerignore" ||
        path === "docs/architecture.md" ||
        path === "docs/getting-started.md"
      );
    case "github-actions":
      return (
        path === ".github/workflows/ci.yml" ||
        path === "docs/architecture.md" ||
        path === "docs/getting-started.md"
      );
    case "ai-rules":
      return (
        path === "AGENTS.md" ||
        path === "docs/ai-rules-sources.md" ||
        path === "docs/architecture.md" ||
        path.startsWith(".cursor/") ||
        path.startsWith(".claude/")
      );
    default:
      return false;
  }
}

function sortStringRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function sectionDelta(
  before: Record<string, string> | undefined,
  after: Record<string, string> | undefined,
): Record<string, string> {
  const delta: Record<string, string> = {};

  for (const [key, value] of Object.entries(after ?? {})) {
    if ((before ?? {})[key] !== value) {
      delta[key] = value;
    }
  }

  return delta;
}

async function readTextFileIfExists(path: string): Promise<string | undefined> {
  if (!(await pathExists(path))) {
    return undefined;
  }

  return readFile(path, "utf8");
}

async function mergeManagedPackageJson(
  path: string,
  previousGeneratedContent: string | undefined,
  nextGeneratedContent: string,
): Promise<boolean> {
  const currentContent = await readTextFileIfExists(path);

  if (!currentContent) {
    await writeTextFile(path, nextGeneratedContent);
    return true;
  }

  const currentJson = JSON.parse(currentContent) as PackageJsonShape & Record<string, unknown>;
  const previousGenerated = previousGeneratedContent
    ? (JSON.parse(previousGeneratedContent) as PackageJsonShape)
    : undefined;
  const nextGenerated = JSON.parse(nextGeneratedContent) as PackageJsonShape;

  const sections: Array<keyof Pick<
    PackageJsonShape,
    "scripts" | "dependencies" | "devDependencies" | "engines"
  >> = ["scripts", "dependencies", "devDependencies", "engines"];

  for (const section of sections) {
    const delta = sectionDelta(previousGenerated?.[section], nextGenerated[section]);

    if (Object.keys(delta).length === 0) {
      continue;
    }

    const currentSection = (currentJson[section] as Record<string, string> | undefined) ?? {};
    currentJson[section] = sortStringRecord({
      ...currentSection,
      ...delta,
    });
  }

  if (
    nextGenerated.packageManager &&
    previousGenerated?.packageManager !== nextGenerated.packageManager
  ) {
    currentJson.packageManager = nextGenerated.packageManager;
  }

  if (
    nextGenerated.pnpm !== undefined &&
    JSON.stringify(previousGenerated?.pnpm) !== JSON.stringify(nextGenerated.pnpm)
  ) {
    currentJson.pnpm = nextGenerated.pnpm;
  }

  const mergedContent = `${JSON.stringify(currentJson, null, 2)}\n`;
  if (mergedContent === currentContent) {
    return false;
  }

  await writeTextFile(path, mergedContent);
  return true;
}

async function existingDependenciesAppearInstalled(cwd: string): Promise<boolean> {
  return pathExists(join(cwd, "node_modules"));
}

async function noDependencyInstallResult(
  packageManager: ProjectPlan["packageManager"],
  cwd: string,
): Promise<InstallResult> {
  const dependenciesInstalled = await existingDependenciesAppearInstalled(cwd);

  return {
    executed: [],
    skipped: dependenciesInstalled ? [] : ["Project dependencies do not appear to be installed in this checkout."],
    dependencyInstall: {
      attempted: false,
      succeeded: dependenciesInstalled,
      skipped: true,
      available: true,
      command: `${packageManager} install`,
      failureReason: dependenciesInstalled
        ? undefined
        : "Project dependencies do not appear to be installed in this checkout.",
    },
  };
}

async function loadDevforgeProjectPlan(cwd: string): Promise<ProjectPlan> {
  const projectPlanPath = join(cwd, PROJECT_PLAN_PATH);

  if (!(await pathExists(projectPlanPath))) {
    throw new Error(
      `This directory does not look like a DevForge project. Expected ${projectPlanPath} to exist.`,
    );
  }

  const plan = await readJson<ProjectPlan>(projectPlanPath);
  if (plan.schemaVersion !== 1) {
    throw new Error(
      `Unsupported DevForge project metadata version in ${projectPlanPath}: ${String(plan.schemaVersion)}.`,
    );
  }

  return {
    ...plan,
    targetDir: cwd,
  };
}

export async function applyAddFeature(
  feature: AddFeature,
  cwd: string,
  environment: EnvironmentInfo,
  options?: ApplyAddFeatureOptions,
): Promise<ApplyAddFeatureResult> {
  const previousPlan = await loadDevforgeProjectPlan(cwd);
  const previousGeneratedFiles = buildGeneratedFileMap(previousPlan, environment);
  const workingPlan = clonePlan(previousPlan);
  const featureAlreadyConfigured = isFeatureConfigured(workingPlan, feature);

  ensureFeatureEnabled(workingPlan, feature);

  const { plan, warnings } = normalizeProjectPlan(workingPlan, environment);
  plan.targetDir = cwd;

  const nextGeneratedFiles = buildGeneratedFileMap(plan, environment);
  const managedFiles = [...nextGeneratedFiles.values()].filter((file) =>
    shouldManagePathForFeature(file.path, feature),
  );

  let requiresDependencyInstall = false;
  const filesWritten: string[] = [];

  for (const file of managedFiles) {
    const targetPath = join(cwd, file.path);
    if (/package\.json$/.test(file.path)) {
      const wrote = await mergeManagedPackageJson(
        targetPath,
        previousGeneratedFiles.get(file.path)?.content,
        file.content,
      );

      if (wrote) {
        filesWritten.push(targetPath);
      }

      if (previousGeneratedFiles.get(file.path)?.content !== file.content) {
        requiresDependencyInstall = true;
      }
      continue;
    }

    const currentContent = await readTextFileIfExists(targetPath);
    if (currentContent === file.content) {
      continue;
    }

    await writeTextFile(targetPath, file.content, file.executable);
    filesWritten.push(targetPath);
  }

  const projectPlanPath = join(cwd, PROJECT_PLAN_PATH);
  await writeJson(projectPlanPath, plan);
  filesWritten.push(projectPlanPath);

  const installPlan: ProjectPlan = {
    ...plan,
    git: {
      ...plan.git,
      initialize: false,
      addRemote: false,
    },
  };

  const installResult =
    requiresDependencyInstall && !options?.skipInstall
      ? runInstallers(installPlan, environment, false, {
          onStep: options?.onStep,
        })
      : await noDependencyInstallResult(plan.packageManager, cwd);

  if (requiresDependencyInstall && options?.skipInstall) {
    installResult.dependencyInstall.succeeded = false;
    installResult.dependencyInstall.skipped = true;
    installResult.dependencyInstall.failureReason = "Dependency installation skipped by flag.";
    installResult.skipped.push("Dependency installation skipped by flag.");
  }

  return {
    plan,
    warnings,
    filesWritten,
    featureAlreadyConfigured,
    installResult,
  };
}

export async function runAddCommand(options: CliOptions): Promise<void> {
  const feature = options.addFeature;
  if (!feature || !ADD_FEATURES.includes(feature)) {
    throw new Error(
      `Choose a supported feature with \`devforge add <feature>\`. Supported features: ${ADD_FEATURES.join(", ")}.`,
    );
  }

  const cwd = process.cwd();
  const environment = detectEnvironment();

  banner("DevForge CLI");
  info(`Platform: ${environment.platform}/${environment.arch}`);
  info(`Node.js: ${environment.nodeVersion}`);
  step(`Package manager preference: ${environment.recommendedPackageManager}`);
  step(`Ensuring feature: ${getFeatureLabel(feature)}`);

  const result = await applyAddFeature(feature, cwd, environment, {
    skipInstall: options.skipInstall,
    onStep(message) {
      step(message);
    },
  });

  for (const warningMessage of result.warnings) {
    warn(warningMessage);
  }

  const guidance = buildRuntimeGuidance(result.plan, environment, result.installResult, cwd);

  success(
    `\n${
      result.featureAlreadyConfigured
        ? `${getFeatureLabel(feature)} is already configured. Managed files were refreshed.`
        : `${getFeatureLabel(feature)} was added to this DevForge project.`
    }`,
  );
  step(`Files updated: ${result.filesWritten.length}`);

  if (result.installResult.executed.length > 0) {
    step(`Executed: ${result.installResult.executed.join(", ")}`);
  }

  if (result.installResult.skipped.length > 0) {
    for (const reason of result.installResult.skipped) {
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
