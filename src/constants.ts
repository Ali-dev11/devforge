import type {
  AiTool,
  ArchitectureMode,
  AuthMode,
  BackendFramework,
  ChromeExtensionFlavor,
  DataFetchingChoice,
  DatabaseChoice,
  DeploymentTarget,
  FrontendFramework,
  FrontendRenderingMode,
  LicenseChoice,
  MicrofrontendStrategy,
  OrmChoice,
  PackageManager,
  ProjectIntent,
  RuleCategory,
  RuleMode,
  StateChoice,
  StrictnessLevel,
  StylingChoice,
  TemplateTier,
  TestEnvironment,
  TestRunner,
  UiLibrary,
  WorkspaceTool,
} from "./types.js";

export const RESUME_STATE_PATH = ".devforge/session.json";
export const PROJECT_PLAN_PATH = ".devforge/project-plan.json";
export const DEFAULT_CONFIG_FILE_NAME = "devforge.config.json";
export const DEFAULT_REMOTE_APPS = ["catalog", "dashboard"];
export const DEFAULT_RULE_CATEGORIES: RuleCategory[] = [
  "core",
  "security",
  "testing",
];
export const REACT_FAMILY_FRAMEWORKS = new Set<FrontendFramework>([
  "nextjs",
  "react-vite",
  "remix",
]);
export const VUE_FAMILY_FRAMEWORKS = new Set<FrontendFramework>([
  "nuxt",
  "vue-vite",
]);
export const INSTALLABLE_PACKAGE_MANAGERS: PackageManager[] = [
  "npm",
  "pnpm",
  "yarn",
  "bun",
];

export const PACKAGE_MANAGER_CHOICES: Array<{
  title: string;
  value: PackageManager;
}> = [
  { title: "npm", value: "npm" },
  { title: "pnpm", value: "pnpm" },
  { title: "yarn", value: "yarn" },
  { title: "bun", value: "bun" },
];

export const PROJECT_INTENT_CHOICES: Array<{
  title: string;
  value: ProjectIntent;
}> = [
  { title: "Landing Page", value: "landing-page" },
  { title: "Frontend App", value: "frontend-app" },
  { title: "Backend API", value: "backend-api" },
  { title: "Fullstack App", value: "fullstack-app" },
  { title: "Microfrontend System", value: "microfrontend-system" },
  { title: "Chrome Extension", value: "chrome-extension" },
  { title: "CLI Tool", value: "cli-tool" },
];

export const TEMPLATE_TIER_CHOICES: Array<{
  title: string;
  value: TemplateTier;
}> = [
  { title: "Blank", value: "blank" },
  { title: "Starter", value: "starter" },
  { title: "Production", value: "production" },
  { title: "Enterprise", value: "enterprise" },
];

export const ARCHITECTURE_CHOICES: Array<{
  title: string;
  value: ArchitectureMode;
}> = [
  { title: "Simple (single app)", value: "simple" },
  { title: "Modular (feature modules)", value: "modular" },
  { title: "Monorepo (apps + packages)", value: "monorepo" },
  { title: "Microfrontend (frontend only)", value: "microfrontend" },
];

export const FRONTEND_FRAMEWORK_CHOICES: Array<{
  title: string;
  value: FrontendFramework;
}> = [
  { title: "Next.js", value: "nextjs" },
  { title: "React (Vite)", value: "react-vite" },
  { title: "Astro", value: "astro" },
  { title: "Remix", value: "remix" },
  { title: "Angular", value: "angular" },
  { title: "Nuxt", value: "nuxt" },
  { title: "Vue (Vite)", value: "vue-vite" },
  { title: "SvelteKit", value: "sveltekit" },
  { title: "Svelte", value: "svelte" },
  { title: "SolidJS", value: "solidjs" },
];

export const FRONTEND_RENDERING_CHOICES: Array<{
  title: string;
  value: FrontendRenderingMode;
}> = [
  { title: "Client-side", value: "client" },
  { title: "Static", value: "static" },
  { title: "SSR", value: "ssr" },
  { title: "SSG", value: "ssg" },
  { title: "ISR", value: "isr" },
];

export const STYLING_CHOICES: Array<{
  title: string;
  value: StylingChoice;
}> = [
  { title: "Tailwind CSS", value: "tailwind-css" },
  { title: "SCSS", value: "scss" },
  { title: "CSS Modules", value: "css-modules" },
  { title: "Vanilla CSS", value: "vanilla-css" },
];

export const UI_LIBRARY_CHOICES: Array<{
  title: string;
  value: UiLibrary;
}> = [
  { title: "None", value: "none" },
  { title: "shadcn/ui", value: "shadcn-ui" },
  { title: "MUI", value: "mui" },
  { title: "Chakra UI", value: "chakra-ui" },
  { title: "Ant Design", value: "ant-design" },
];

export const STATE_CHOICES: Array<{
  title: string;
  value: StateChoice;
}> = [
  { title: "None", value: "none" },
  { title: "Zustand", value: "zustand" },
  { title: "Redux", value: "redux" },
  { title: "Redux Toolkit", value: "redux-toolkit" },
  { title: "MobX", value: "mobx" },
  { title: "Jotai", value: "jotai" },
  { title: "TanStack Store", value: "tanstack-store" },
];

export const DATA_FETCHING_CHOICES: Array<{
  title: string;
  value: DataFetchingChoice;
}> = [
  { title: "None", value: "none" },
  { title: "TanStack Query", value: "tanstack-query" },
  { title: "RTK Query", value: "rtk-query" },
  { title: "Apollo Client", value: "apollo-client" },
  { title: "SWR", value: "swr" },
  { title: "Native Fetch", value: "native-fetch" },
];

export const STRICTNESS_CHOICES: Array<{
  title: string;
  value: StrictnessLevel;
}> = [
  { title: "Low", value: "low" },
  { title: "Moderate", value: "moderate" },
  { title: "Strict", value: "strict" },
];

export const TEST_RUNNER_CHOICES: Array<{
  title: string;
  value: TestRunner;
}> = [
  { title: "Vitest", value: "vitest" },
  { title: "Jest", value: "jest" },
  { title: "Playwright", value: "playwright" },
  { title: "Cypress", value: "cypress" },
];

export const TEST_ENVIRONMENT_CHOICES: Array<{
  title: string;
  value: TestEnvironment;
}> = [
  { title: "Node", value: "node" },
  { title: "jsdom", value: "jsdom" },
  { title: "happy-dom", value: "happy-dom" },
];

export const DEPLOYMENT_TARGET_CHOICES: Array<{
  title: string;
  value: DeploymentTarget;
}> = [
  { title: "None", value: "none" },
  { title: "Vercel", value: "vercel" },
  { title: "Netlify", value: "netlify" },
  { title: "Docker Compose", value: "docker-compose" },
];

export const BACKEND_FRAMEWORK_CHOICES: Array<{
  title: string;
  value: BackendFramework;
}> = [
  { title: "NestJS", value: "nestjs" },
  { title: "Express", value: "express" },
  { title: "Fastify", value: "fastify" },
  { title: "Hono", value: "hono" },
  { title: "Koa", value: "koa" },
];

export const AUTH_CHOICES: Array<{
  title: string;
  value: AuthMode;
}> = [
  { title: "JWT Authentication", value: "jwt" },
  { title: "OAuth", value: "oauth" },
];

export const ORM_CHOICES: Array<{
  title: string;
  value: OrmChoice;
}> = [
  { title: "None", value: "none" },
  { title: "Prisma", value: "prisma" },
  { title: "Drizzle (SQL)", value: "drizzle" },
];

export const DATABASE_CHOICES: Array<{
  title: string;
  value: DatabaseChoice;
}> = [
  { title: "None", value: "none" },
  { title: "PostgreSQL", value: "postgresql" },
  { title: "MongoDB", value: "mongodb" },
];

export const WORKSPACE_TOOL_CHOICES: Array<{
  title: string;
  value: WorkspaceTool;
}> = [
  { title: "TurboRepo", value: "turborepo" },
  { title: "Nx", value: "nx" },
];

export const MICROFRONTEND_STRATEGY_CHOICES: Array<{
  title: string;
  value: MicrofrontendStrategy;
}> = [
  { title: "Module Federation", value: "module-federation" },
  { title: "Vite Federation (supported)", value: "vite-federation" },
  { title: "Single-SPA", value: "single-spa" },
];

export const SUPPORTED_MICROFRONTEND_STRATEGIES: MicrofrontendStrategy[] = [
  "vite-federation",
];

export const EXTENSION_FLAVOR_CHOICES: Array<{
  title: string;
  value: ChromeExtensionFlavor;
}> = [
  { title: "React-based extension", value: "react" },
  { title: "Vanilla TypeScript", value: "vanilla-ts" },
];

export const AI_TOOL_CHOICES: Array<{
  title: string;
  value: AiTool;
}> = [
  { title: "Cursor", value: "cursor" },
  { title: "Claude", value: "claude" },
  { title: "Codex", value: "codex" },
];

export const RULE_MODE_CHOICES: Array<{
  title: string;
  value: RuleMode;
}> = [
  { title: "Minimal", value: "minimal" },
  { title: "Balanced", value: "balanced" },
  { title: "Strict", value: "strict" },
];

export const RULE_CATEGORY_CHOICES: Array<{
  title: string;
  value: RuleCategory;
}> = [
  { title: "Core rules", value: "core" },
  { title: "Frontend rules", value: "frontend" },
  { title: "Backend rules", value: "backend" },
  { title: "Architecture rules", value: "architecture" },
  { title: "Security rules", value: "security" },
  { title: "Testing rules", value: "testing" },
];

export const LICENSE_CHOICES: Array<{
  title: string;
  value: LicenseChoice;
}> = [
  { title: "MIT", value: "MIT" },
  { title: "Apache 2.0", value: "Apache-2.0" },
  { title: "ISC", value: "ISC" },
  { title: "Unlicense", value: "Unlicense" },
  { title: "Proprietary", value: "Proprietary" },
];
