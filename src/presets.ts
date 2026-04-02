import { readProjectPlanConfig, buildProjectPlanFromConfig } from "./config.js";
import type {
  CliOptions,
  EnvironmentInfo,
  ProjectPlan,
  ProjectPlanConfig,
} from "./types.js";

type BuiltinPresetName =
  | "frontend-app"
  | "backend-api"
  | "fullstack-app"
  | "chrome-extension";

const BUILTIN_PRESETS: Record<BuiltinPresetName, Partial<ProjectPlanConfig>> = {
  "frontend-app": {
    schemaVersion: 1,
    intent: "frontend-app",
    architecture: "simple",
    templateTier: "production",
    frontend: {
      framework: "react-vite",
      rendering: "client",
      styling: "tailwind-css",
      uiLibrary: "shadcn-ui",
      state: "zustand",
      dataFetching: "tanstack-query",
    },
    testing: {
      enabled: true,
      runner: "vitest",
      environment: "jsdom",
      includeExampleTests: true,
    },
    tooling: {
      eslint: true,
      eslintProfile: "moderate",
      prettier: true,
      prettierProfile: "moderate",
      husky: false,
      huskyProfile: "moderate",
      commitlint: false,
      docker: false,
      githubActions: true,
    },
    deployment: {
      target: "none",
    },
  },
  "backend-api": {
    schemaVersion: 1,
    intent: "backend-api",
    architecture: "modular",
    templateTier: "production",
    backend: {
      framework: "hono",
      language: "typescript",
      auth: [],
      orm: "none",
      database: "none",
      redis: false,
      swagger: true,
      websockets: false,
    },
    testing: {
      enabled: true,
      runner: "jest",
      environment: "node",
      includeExampleTests: true,
    },
    tooling: {
      eslint: true,
      eslintProfile: "moderate",
      prettier: true,
      prettierProfile: "moderate",
      husky: false,
      huskyProfile: "moderate",
      commitlint: false,
      docker: false,
      githubActions: true,
    },
    deployment: {
      target: "none",
    },
  },
  "fullstack-app": {
    schemaVersion: 1,
    intent: "fullstack-app",
    architecture: "simple",
    templateTier: "production",
    frontend: {
      framework: "react-vite",
      rendering: "client",
      styling: "tailwind-css",
      uiLibrary: "shadcn-ui",
      state: "zustand",
      dataFetching: "tanstack-query",
    },
    backend: {
      framework: "hono",
      language: "typescript",
      auth: [],
      orm: "none",
      database: "none",
      redis: false,
      swagger: true,
      websockets: false,
    },
    testing: {
      enabled: true,
      runner: "vitest",
      environment: "jsdom",
      includeExampleTests: true,
    },
    tooling: {
      eslint: true,
      eslintProfile: "moderate",
      prettier: true,
      prettierProfile: "moderate",
      husky: false,
      huskyProfile: "moderate",
      commitlint: false,
      docker: false,
      githubActions: true,
    },
    deployment: {
      target: "none",
    },
  },
  "chrome-extension": {
    schemaVersion: 1,
    intent: "chrome-extension",
    architecture: "modular",
    templateTier: "production",
    extension: {
      flavor: "react",
      includesBackground: true,
      includesContent: true,
      includesPopup: true,
      manifestVersion: "v3",
    },
    testing: {
      enabled: true,
      runner: "vitest",
      environment: "jsdom",
      includeExampleTests: true,
    },
    tooling: {
      eslint: true,
      eslintProfile: "moderate",
      prettier: true,
      prettierProfile: "moderate",
      husky: false,
      huskyProfile: "moderate",
      commitlint: false,
      docker: false,
      githubActions: true,
    },
    deployment: {
      target: "none",
    },
  },
};

export function isBuiltinPresetName(value: string): value is BuiltinPresetName {
  return value in BUILTIN_PRESETS;
}

export function getBuiltinPresetConfig(
  name: BuiltinPresetName,
): Partial<ProjectPlanConfig> {
  return BUILTIN_PRESETS[name];
}

export async function readProjectPlanPreset(
  reference: string,
  environment: EnvironmentInfo,
  options: CliOptions,
): Promise<ProjectPlan> {
  if (isBuiltinPresetName(reference)) {
    return buildProjectPlanFromConfig(getBuiltinPresetConfig(reference), environment, options);
  }

  return readProjectPlanConfig(reference, environment, options);
}
