export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
export type NodeStrategy = "lts" | "latest" | "custom";
export type ProjectIntent =
  | "landing-page"
  | "frontend-app"
  | "backend-api"
  | "fullstack-app"
  | "microfrontend-system"
  | "chrome-extension"
  | "cli-tool";
export type ArchitectureMode =
  | "simple"
  | "modular"
  | "monorepo"
  | "microfrontend";
export type TemplateTier = "blank" | "starter" | "production" | "enterprise";
export type FrontendFramework =
  | "nextjs"
  | "react-vite"
  | "astro"
  | "remix"
  | "angular"
  | "nuxt"
  | "vue-vite"
  | "sveltekit"
  | "svelte"
  | "solidjs";
export type FrontendRenderingMode =
  | "client"
  | "ssr"
  | "ssg"
  | "isr"
  | "static";
export type StylingChoice =
  | "tailwind-css"
  | "scss"
  | "css-modules"
  | "vanilla-css";
export type UiLibrary =
  | "none"
  | "shadcn-ui"
  | "mui"
  | "chakra-ui"
  | "ant-design";
export type StateChoice =
  | "none"
  | "zustand"
  | "redux"
  | "redux-toolkit"
  | "mobx"
  | "jotai"
  | "tanstack-store";
export type DataFetchingChoice =
  | "none"
  | "tanstack-query"
  | "rtk-query"
  | "apollo-client"
  | "swr"
  | "native-fetch";
export type BackendFramework = "nestjs" | "express" | "fastify" | "hono" | "koa";
export type BackendLanguage = "typescript" | "javascript";
export type NestAdapter = "express" | "fastify";
export type AuthMode = "jwt" | "oauth";
export type OrmChoice = "none" | "prisma" | "drizzle";
export type DatabaseChoice = "none" | "postgresql" | "mongodb";
export type WorkspaceTool = "turborepo" | "nx";
export type MicrofrontendStrategy =
  | "module-federation"
  | "vite-federation"
  | "single-spa";
export type ChromeExtensionFlavor = "react" | "vanilla-ts";
export type AiTool = "cursor" | "claude" | "codex";
export type RuleMode = "minimal" | "balanced" | "strict";
export type RuleCategory =
  | "core"
  | "frontend"
  | "backend"
  | "architecture"
  | "security"
  | "testing";
export type StrictnessLevel = "low" | "moderate" | "strict";
export type TestRunner = "none" | "vitest" | "jest" | "playwright" | "cypress";
export type TestEnvironment = "none" | "node" | "jsdom" | "happy-dom" | "browser-e2e";
export type LicenseChoice =
  | "MIT"
  | "Apache-2.0"
  | "ISC"
  | "Unlicense"
  | "Proprietary";

export interface CliOptions {
  command: "init" | "help" | "version";
  resume: boolean;
  skipInstall: boolean;
  yes: boolean;
  outputDir?: string;
  projectName?: string;
}

export interface BinaryStatus {
  installed: boolean;
  path?: string;
  version?: string;
}

export interface EnvironmentInfo {
  platform: NodeJS.Platform;
  arch: string;
  nodeVersion: string;
  recommendedPackageManager: PackageManager;
  packageManagers: Record<PackageManager, BinaryStatus>;
}

export interface FrontendConfig {
  framework: FrontendFramework;
  rendering: FrontendRenderingMode;
  styling: StylingChoice;
  uiLibrary: UiLibrary;
  state: StateChoice;
  dataFetching: DataFetchingChoice;
}

export interface BackendConfig {
  framework: BackendFramework;
  language: BackendLanguage;
  adapter?: NestAdapter;
  auth: AuthMode[];
  orm: OrmChoice;
  database: DatabaseChoice;
  redis: boolean;
  swagger: boolean;
  websockets: boolean;
}

export interface WorkspaceConfig {
  tool?: WorkspaceTool;
  microfrontendStrategy?: MicrofrontendStrategy;
  remoteApps: string[];
}

export interface ChromeExtensionConfig {
  flavor: ChromeExtensionFlavor;
  includesBackground: boolean;
  includesContent: boolean;
  includesPopup: boolean;
  manifestVersion: "v3";
}

export interface AiConfig {
  tools: AiTool[];
  ruleMode: RuleMode;
  categories: RuleCategory[];
}

export interface ToolingConfig {
  eslint: boolean;
  eslintProfile: StrictnessLevel;
  prettier: boolean;
  prettierProfile: StrictnessLevel;
  husky: boolean;
  huskyProfile: StrictnessLevel;
  commitlint: boolean;
  docker: boolean;
  githubActions: boolean;
}

export interface TestingConfig {
  enabled: boolean;
  runner: TestRunner;
  environment: TestEnvironment;
  includeExampleTests: boolean;
}

export interface GitConfig {
  initialize: boolean;
  setupSsh: boolean;
  addRemote: boolean;
  remoteUrl?: string;
}

export interface MetadataConfig {
  description: string;
  license: LicenseChoice;
  generateReadme: boolean;
  generateEnvExample: boolean;
}

export interface ProjectPlan {
  schemaVersion: 1;
  projectName: string;
  targetDir: string;
  nodeStrategy: NodeStrategy;
  customNodeVersion?: string;
  packageManager: PackageManager;
  intent: ProjectIntent;
  architecture: ArchitectureMode;
  templateTier: TemplateTier;
  frontend?: FrontendConfig;
  backend?: BackendConfig;
  workspace: WorkspaceConfig;
  extension?: ChromeExtensionConfig;
  ai: AiConfig;
  tooling: ToolingConfig;
  testing: TestingConfig;
  git: GitConfig;
  metadata: MetadataConfig;
}

export interface ResumeState {
  updatedAt: string;
  plan: ProjectPlan;
}

export interface NormalizedPlanResult {
  plan: ProjectPlan;
  warnings: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  executable?: boolean;
}

export interface GeneratedProjectResult {
  targetDir: string;
  filesWritten: string[];
  notes: string[];
}

export interface InstallResult {
  executed: string[];
  skipped: string[];
}
