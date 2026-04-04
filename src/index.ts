export { runCli } from "./cli.js";
export { applyAddFeature, runAddCommand } from "./commands/add.js";
export { runInitCommand } from "./commands/init.js";
export { applyUpgrade, runUpgradeCommand } from "./commands/upgrade.js";
export { buildAiRuleFiles } from "./engines/ai-rules.js";
export { normalizeProjectPlan } from "./engines/decision.js";
export { detectEnvironment } from "./engines/environment.js";
export { generateProject } from "./engines/generator.js";
export { runInstallers } from "./engines/installer.js";
export { buildDefaultPlan, collectProjectPlan } from "./engines/prompts.js";
export { getBuiltinPresetConfig, isBuiltinPresetName, readProjectPlanPreset } from "./presets.js";
export {
  expectedBackendFrameworkCoverage,
  expectedIntentCoverage,
  getRuntimeScenario,
  runRuntimeMatrix,
  runtimeScenarioCoverage,
  runtimeScenarios,
} from "./runtime-matrix.js";
export { buildProjectFiles } from "./templates.js";
export type * from "./types.js";
