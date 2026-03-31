import { resolve } from "node:path";
import { DEFAULT_CONFIG_FILE_NAME } from "./constants.js";
import {
  applyIntentDefaultsForChange,
  buildDefaultPlan,
} from "./engines/prompts.js";
import type {
  CliOptions,
  EnvironmentInfo,
  ProjectPlan,
  ProjectPlanConfig,
} from "./types.js";
import { readJson, writeJson } from "./utils/fs.js";
import { slugifyProjectName } from "./utils/strings.js";

type PartialProjectPlanConfig = Partial<ProjectPlanConfig>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function applyIntentFromConfig(
  plan: ProjectPlan,
  nextIntent: ProjectPlan["intent"] | undefined,
): void {
  if (!nextIntent || nextIntent === plan.intent) {
    return;
  }

  const previousIntent = plan.intent;
  plan.intent = nextIntent;
  applyIntentDefaultsForChange(plan, previousIntent);
}

function mergeNestedConfig<T extends object>(
  base: T | undefined,
  override: Partial<T> | undefined,
): T | undefined {
  if (!override) {
    return base;
  }

  return {
    ...(base ?? {}),
    ...override,
  } as T;
}

export function resolveConfigPath(path: string): string {
  return resolve(process.cwd(), path);
}

export function defaultConfigOutputPath(targetDir: string): string {
  return resolve(targetDir, DEFAULT_CONFIG_FILE_NAME);
}

export function serializeProjectPlanConfig(plan: ProjectPlan): ProjectPlanConfig {
  const config: ProjectPlanConfig = {
    ...plan,
    schemaVersion: 1,
  };

  delete config.targetDir;
  return config;
}

export function buildProjectPlanFromConfig(
  configInput: unknown,
  environment: EnvironmentInfo,
  options: CliOptions,
): ProjectPlan {
  if (!isRecord(configInput)) {
    throw new Error("DevForge config files must contain a JSON object that mirrors a saved project plan.");
  }

  const config = configInput as PartialProjectPlanConfig;
  if (config.schemaVersion !== undefined && config.schemaVersion !== 1) {
    throw new Error(`Unsupported DevForge config schemaVersion: ${String(config.schemaVersion)}.`);
  }

  const baseOptions: CliOptions = {
    ...options,
    projectName: undefined,
    outputDir: undefined,
  };
  const plan = buildDefaultPlan(environment, baseOptions);

  applyIntentFromConfig(plan, config.intent);

  if (config.projectName) {
    plan.projectName = slugifyProjectName(config.projectName) || plan.projectName;
  }
  plan.nodeStrategy = config.nodeStrategy ?? plan.nodeStrategy;
  plan.customNodeVersion = config.customNodeVersion ?? plan.customNodeVersion;
  plan.packageManager = config.packageManager ?? plan.packageManager;
  plan.architecture = config.architecture ?? plan.architecture;
  plan.templateTier = config.templateTier ?? plan.templateTier;

  plan.frontend = mergeNestedConfig(plan.frontend, config.frontend);
  plan.backend = mergeNestedConfig(plan.backend, config.backend);
  plan.extension = mergeNestedConfig(plan.extension, config.extension);
  plan.workspace = mergeNestedConfig(plan.workspace, config.workspace) ?? plan.workspace;
  plan.ai = mergeNestedConfig(plan.ai, config.ai) ?? plan.ai;
  plan.tooling = mergeNestedConfig(plan.tooling, config.tooling) ?? plan.tooling;
  plan.testing = mergeNestedConfig(plan.testing, config.testing) ?? plan.testing;
  plan.git = mergeNestedConfig(plan.git, config.git) ?? plan.git;
  plan.metadata = mergeNestedConfig(plan.metadata, config.metadata) ?? plan.metadata;

  if (options.projectName) {
    const normalizedProjectName = slugifyProjectName(options.projectName);
    if (normalizedProjectName) {
      plan.projectName = normalizedProjectName;
    }
  }

  if (options.outputDir) {
    plan.targetDir = resolve(process.cwd(), options.outputDir);
  } else if (config.targetDir) {
    plan.targetDir = resolve(process.cwd(), config.targetDir);
  } else {
    plan.targetDir = resolve(process.cwd(), plan.projectName);
  }

  return plan;
}

export async function readProjectPlanConfig(
  path: string,
  environment: EnvironmentInfo,
  options: CliOptions,
): Promise<ProjectPlan> {
  const resolvedPath = resolveConfigPath(path);
  try {
    const configInput = await readJson<unknown>(resolvedPath);
    return buildProjectPlanFromConfig(configInput, environment, options);
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      throw new Error(`Could not find a DevForge config at ${resolvedPath}.`);
    }

    if (error instanceof SyntaxError) {
      throw new Error(`DevForge config at ${resolvedPath} is not valid JSON.`);
    }

    throw error;
  }
}

export async function writeProjectPlanConfig(
  path: string,
  plan: ProjectPlan,
): Promise<void> {
  await writeJson(path, serializeProjectPlanConfig(plan));
}
