import { existsSync } from "node:fs";
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
  AdvisoryItem,
  CliOptions,
  EnvironmentInfo,
  GeneratedFile,
  InstallResult,
  ProjectPlan,
} from "../types.js";
import { pathExists, readJson, removeFile, writeJson, writeTextFile } from "../utils/fs.js";
import { banner, info, step, success, warn } from "../utils/logger.js";

export type ApplyUpgradeOptions = {
  skipInstall?: boolean;
  onStep?: (message: string) => void;
};

export type ApplyUpgradeResult = {
  plan: ProjectPlan;
  warnings: string[];
  filesWritten: string[];
  skippedManaged: string[];
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

const TARGET_EXCLUSIVE_MANAGED_PATHS = [
  "vercel.json",
  "netlify.toml",
  "render.yaml",
  "railway.toml",
  "docker-compose.yml",
] as const;

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

function buildGeneratedFileMap(
  plan: ProjectPlan,
  environment: EnvironmentInfo,
): Map<string, GeneratedFile> {
  const files = [...buildProjectFiles(plan, environment), ...buildAiRuleFiles(plan)];
  return new Map(files.map((file) => [file.path, file]));
}

function buildTargetExclusiveManagedContentCandidates(
  plan: ProjectPlan,
  environment: EnvironmentInfo,
  path: (typeof TARGET_EXCLUSIVE_MANAGED_PATHS)[number],
): Set<string> {
  const candidates = new Set<string>();
  const targets: ProjectPlan["deployment"]["target"][] = [
    "vercel",
    "netlify",
    "render",
    "railway",
    "docker-compose",
  ];

  for (const target of targets) {
    const variant: ProjectPlan = JSON.parse(JSON.stringify(plan)) as ProjectPlan;
    variant.deployment.target = target;
    if (target === "docker-compose") {
      variant.tooling.docker = true;
    }

    const content = buildGeneratedFileMap(variant, environment).get(path)?.content;
    if (content) {
      candidates.add(content);
    }
  }

  return candidates;
}

function shouldManagePathForUpgrade(path: string): boolean {
  return (
    path === "README.md" ||
    path === "LICENSE" ||
    path === ".editorconfig" ||
    path === ".gitattributes" ||
    path === ".gitignore" ||
    path === ".nvmrc" ||
    path === ".env.example" ||
    path === "package.json" ||
    path === "tsconfig.json" ||
    path === "tsconfig.server.json" ||
    path === "next-env.d.ts" ||
    path === "turbo.json" ||
    path === "nx.json" ||
    path === "pnpm-workspace.yaml" ||
    path === "eslint.config.js" ||
    path === ".prettierrc" ||
    path === "commitlint.config.cjs" ||
    path === "Dockerfile" ||
    path === ".dockerignore" ||
    path === "docker-compose.yml" ||
    path === "vercel.json" ||
    path === "netlify.toml" ||
    path === "render.yaml" ||
    path === "railway.toml" ||
    path === "AGENTS.md" ||
    path === "docs/architecture.md" ||
    path === "docs/getting-started.md" ||
    path === "docs/ai-rules-sources.md" ||
    path === "docs/microfrontends.md" ||
    path === ".github/workflows/ci.yml" ||
    path === ".github/workflows/deploy.yml" ||
    path.startsWith(".cursor/") ||
    path.startsWith(".claude/") ||
    path.startsWith(".husky/") ||
    /(^|\/)(vitest|playwright|cypress)\.config\.(ts|js)$/.test(path) ||
    /(^|\/)jest\.config\.cjs$/.test(path)
  );
}

function hasManagedMarker(content: string | undefined): boolean {
  return Boolean(content?.includes("Managed by DevForge. Safe to refresh with devforge upgrade."));
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

  let currentJson: PackageJsonShape & Record<string, unknown>;
  let previousGenerated: PackageJsonShape | undefined;
  let nextGenerated: PackageJsonShape;

  try {
    currentJson = JSON.parse(currentContent) as PackageJsonShape & Record<string, unknown>;
    previousGenerated = previousGeneratedContent
      ? (JSON.parse(previousGeneratedContent) as PackageJsonShape)
      : undefined;
    nextGenerated = JSON.parse(nextGeneratedContent) as PackageJsonShape;
  } catch {
    throw new Error(
      `Could not update ${path} because it is not valid JSON. Fix the file or update it manually.`,
    );
  }

  const sections: Array<keyof Pick<
    PackageJsonShape,
    "scripts" | "dependencies" | "devDependencies" | "engines"
  >> = ["scripts", "dependencies", "devDependencies", "engines"];

  let changed = false;
  for (const section of sections) {
    const delta = sectionDelta(previousGenerated?.[section], nextGenerated[section]);
    if (Object.keys(delta).length === 0) {
      continue;
    }

    const currentSection = (currentJson[section] as Record<string, string> | undefined) ?? {};
    const merged = sortStringRecord({
      ...currentSection,
      ...delta,
    });
    if (JSON.stringify(merged) !== JSON.stringify(currentSection)) {
      currentJson[section] = merged;
      changed = true;
    }
  }

  if (
    nextGenerated.packageManager &&
    previousGenerated?.packageManager !== nextGenerated.packageManager &&
    currentJson.packageManager !== nextGenerated.packageManager
  ) {
    currentJson.packageManager = nextGenerated.packageManager;
    changed = true;
  }

  if (
    nextGenerated.pnpm !== undefined &&
    JSON.stringify(previousGenerated?.pnpm) !== JSON.stringify(nextGenerated.pnpm) &&
    JSON.stringify(currentJson.pnpm) !== JSON.stringify(nextGenerated.pnpm)
  ) {
    currentJson.pnpm = nextGenerated.pnpm;
    changed = true;
  }

  if (!changed) {
    return false;
  }

  await writeTextFile(path, `${JSON.stringify(currentJson, null, 2)}\n`);
  return true;
}

function existingDependenciesAppearInstalled(cwd: string): boolean {
  return existsSync(join(cwd, "node_modules"));
}

function noDependencyInstallResult(
  plan: ProjectPlan,
  cwd: string,
): InstallResult {
  const dependenciesInstalled = existingDependenciesAppearInstalled(cwd);
  const missingDependenciesMessage =
    "Project dependencies do not appear to be installed. Run the package manager install command before using the refreshed scaffold.";

  return {
    executed: [],
    skipped: dependenciesInstalled ? [] : [missingDependenciesMessage],
    dependencyInstall: {
      attempted: false,
      succeeded: dependenciesInstalled,
      skipped: true,
      available: true,
      command: `${plan.packageManager} install`,
      failureReason: dependenciesInstalled
        ? undefined
        : missingDependenciesMessage,
    },
  };
}

async function readStoredPlan(cwd: string): Promise<ProjectPlan> {
  const projectPlanPath = join(cwd, PROJECT_PLAN_PATH);
  if (!(await pathExists(projectPlanPath))) {
    throw new Error("Current directory does not look like a DevForge project. Expected .devforge/project-plan.json.");
  }

  try {
    const plan = await readJson<ProjectPlan>(projectPlanPath);
    if (plan.schemaVersion !== 1) {
      throw new Error(
        `Unsupported DevForge project metadata version in ${projectPlanPath}: ${String(plan.schemaVersion)}.`,
      );
    }

    return plan;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(".devforge/project-plan.json is not valid JSON.");
    }

    throw error;
  }
}

export async function applyUpgrade(
  cwd: string,
  environment: EnvironmentInfo,
  options: ApplyUpgradeOptions = {},
): Promise<ApplyUpgradeResult> {
  const previousPlan = {
    ...(await readStoredPlan(cwd)),
    targetDir: cwd,
  };
  const { plan, warnings } = normalizeProjectPlan(previousPlan, environment);
  const previousGenerated = buildGeneratedFileMap(previousPlan, environment);
  const nextGenerated = buildGeneratedFileMap(plan, environment);
  const filesWritten: string[] = [];
  const skippedManaged: string[] = [];
  let packageJsonChanged = false;

  for (const [relativePath, nextFile] of nextGenerated.entries()) {
    if (!shouldManagePathForUpgrade(relativePath)) {
      continue;
    }

    const absolutePath = join(cwd, relativePath);

    if (relativePath === "package.json") {
      const changed = await mergeManagedPackageJson(
        absolutePath,
        previousGenerated.get(relativePath)?.content,
        nextFile.content,
      );
      if (changed) {
        packageJsonChanged = true;
        filesWritten.push(absolutePath);
      }
      continue;
    }

    const currentContent = await readTextFileIfExists(absolutePath);
    const previousContent = previousGenerated.get(relativePath)?.content;

    if (currentContent === nextFile.content) {
      continue;
    }

    if (
      currentContent === undefined ||
      currentContent === previousContent ||
      hasManagedMarker(currentContent)
    ) {
      await writeTextFile(absolutePath, nextFile.content, nextFile.executable);
      filesWritten.push(absolutePath);
      continue;
    }

    skippedManaged.push(relativePath);
  }

  for (const [relativePath, previousFile] of previousGenerated.entries()) {
    if (!shouldManagePathForUpgrade(relativePath) || nextGenerated.has(relativePath)) {
      continue;
    }

    const absolutePath = join(cwd, relativePath);
    const currentContent = await readTextFileIfExists(absolutePath);

    if (currentContent === undefined) {
      continue;
    }

    if (currentContent === previousFile.content || hasManagedMarker(currentContent)) {
      await removeFile(absolutePath);
      filesWritten.push(absolutePath);
      continue;
    }

    skippedManaged.push(relativePath);
  }

  for (const relativePath of TARGET_EXCLUSIVE_MANAGED_PATHS) {
    if (nextGenerated.has(relativePath)) {
      continue;
    }

    const absolutePath = join(cwd, relativePath);
    const currentContent = await readTextFileIfExists(absolutePath);
    if (currentContent === undefined) {
      continue;
    }

    const generatedCandidates = buildTargetExclusiveManagedContentCandidates(
      plan,
      environment,
      relativePath,
    );

    if (generatedCandidates.has(currentContent)) {
      await removeFile(absolutePath);
      filesWritten.push(absolutePath);
    }
  }

  const projectPlanPath = join(cwd, PROJECT_PLAN_PATH);
  const previousPlanJson = JSON.stringify(previousPlan, null, 2);
  const nextPlanJson = JSON.stringify(plan, null, 2);
  if (previousPlanJson !== nextPlanJson) {
    await writeJson(projectPlanPath, plan);
    filesWritten.push(projectPlanPath);
  }

  let installResult: InstallResult;
  if (packageJsonChanged) {
    const installPlan: ProjectPlan = {
      ...plan,
      git: {
        ...plan.git,
        initialize: false,
        addRemote: false,
      },
    };
    installResult = runInstallers(installPlan, environment, Boolean(options.skipInstall), {
      onStep: options.onStep,
    });
  } else {
    installResult = noDependencyInstallResult(plan, cwd);
  }

  return {
    plan,
    warnings,
    filesWritten,
    skippedManaged,
    installResult,
  };
}

export async function runUpgradeCommand(options: CliOptions): Promise<void> {
  const cwd = process.cwd();
  const environment = detectEnvironment();

  banner("DevForge Upgrade");
  info(`Platform: ${environment.platform}/${environment.arch}`);
  info(`Node.js: ${environment.nodeVersion}`);
  step(`Working directory: ${cwd}`);

  const result = await applyUpgrade(cwd, environment, {
    skipInstall: options.skipInstall,
    onStep(message) {
      step(message);
    },
  });

  for (const warning of result.warnings) {
    warn(warning);
  }

  const guidance = buildRuntimeGuidance(result.plan, environment, result.installResult, cwd);

  success(
    result.filesWritten.length > 0
      ? "\nDevForge managed surfaces were refreshed."
      : "\nManaged files already matched the current DevForge version.",
  );
  step(`Files written: ${result.filesWritten.length}`);

  if (result.installResult.executed.length > 0) {
    step(`Executed: ${result.installResult.executed.join(", ")}`);
  }

  if (result.installResult.skipped.length > 0) {
    for (const reason of result.installResult.skipped) {
      warn(reason);
    }
  }

  if (result.skippedManaged.length > 0) {
    warn(
      `Skipped ${result.skippedManaged.length} managed file${result.skippedManaged.length === 1 ? "" : "s"} because they no longer match the previous generated baseline: ${result.skippedManaged.join(", ")}`,
    );
  }

  printAdvisorySection("Required before run", guidance.requiredBeforeRun, {
    warnItems: true,
  });
  printNextCommands(guidance.nextCommands);
  printAdvisorySection("Recommended", guidance.recommended);
  printStackNotes(guidance.stackNotes);
}
