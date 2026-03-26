import type {
  AdvisoryItem,
  ArchitectureMode,
  BackendFramework,
  BackendLanguage,
  EnvironmentInfo,
  FrontendFramework,
  FrontendRenderingMode,
  InstallResult,
  PackageManager,
  PostCreateGuidance,
  ProjectIntent,
  ProjectPlan,
  TestRunner,
  UiLibrary,
  StateChoice,
  DataFetchingChoice,
} from "./types.js";
import { REACT_FAMILY_FRAMEWORKS, VUE_FAMILY_FRAMEWORKS } from "./constants.js";

const ALL_PACKAGE_MANAGERS: PackageManager[] = ["npm", "pnpm", "yarn", "bun"];
const ALL_UI_LIBRARIES: UiLibrary[] = [
  "none",
  "shadcn-ui",
  "mui",
  "chakra-ui",
  "ant-design",
];
const ALL_STATE_CHOICES: StateChoice[] = [
  "none",
  "zustand",
  "redux",
  "redux-toolkit",
  "mobx",
  "jotai",
  "tanstack-store",
];
const ALL_DATA_FETCHING_CHOICES: DataFetchingChoice[] = [
  "none",
  "tanstack-query",
  "rtk-query",
  "apollo-client",
  "swr",
  "native-fetch",
];

const BUN_SUPPORTED_FRONTEND_FRAMEWORKS = new Set<FrontendFramework>([
  "react-vite",
  "astro",
  "remix",
  "vue-vite",
  "svelte",
  "solidjs",
]);

const SUPPORTED_RENDERING_MODES: Record<FrontendFramework, FrontendRenderingMode[]> = {
  nextjs: ["ssr", "ssg", "isr"],
  "react-vite": ["client", "static"],
  astro: ["static", "ssr"],
  remix: ["ssr"],
  angular: ["client"],
  nuxt: ["ssr", "ssg"],
  "vue-vite": ["client", "static"],
  sveltekit: ["ssr", "ssg"],
  svelte: ["client", "static"],
  solidjs: ["client", "static"],
};

function hasFrontendLikeSurface(plan: ProjectPlan): boolean {
  return Boolean(plan.frontend) || plan.intent === "chrome-extension";
}

function platformScopedPlaywrightInstallCommand(platform: NodeJS.Platform): string {
  return platform === "linux"
    ? "npx playwright install --with-deps"
    : "npx playwright install";
}

function platformScopedNodeSetupCommand(
  platform: NodeJS.Platform,
  customNodeVersion: string | undefined,
): string | undefined {
  if (!customNodeVersion) {
    return undefined;
  }

  if (platform === "win32") {
    return `nvm install ${customNodeVersion} && nvm use ${customNodeVersion}`;
  }

  return `nvm install ${customNodeVersion} && nvm use ${customNodeVersion}`;
}

function platformScopedGitInstallCommand(platform: NodeJS.Platform): string {
  switch (platform) {
    case "darwin":
      return "xcode-select --install";
    case "win32":
      return "winget install Git.Git";
    case "linux":
    default:
      return "sudo apt-get update && sudo apt-get install -y git";
  }
}

function platformScopedDockerInstallCommand(platform: NodeJS.Platform): string {
  switch (platform) {
    case "darwin":
      return "brew install --cask docker";
    case "win32":
      return "winget install Docker.DockerDesktop";
    case "linux":
    default:
      return "curl -fsSL https://get.docker.com | sh";
  }
}

function hasSystemTool(
  environment: EnvironmentInfo,
  tool: keyof NonNullable<EnvironmentInfo["systemTools"]>,
): boolean {
  return environment.systemTools?.[tool]?.installed ?? false;
}

function platformScopedPackageManagerInstallCommand(
  packageManager: PackageManager,
  environment: EnvironmentInfo,
): string | undefined {
  switch (packageManager) {
    case "pnpm":
    case "yarn":
      return hasSystemTool(environment, "corepack")
        ? `corepack enable && corepack prepare ${packageManager}@latest --activate`
        : `npm install -g ${packageManager}`;
    case "bun":
      return environment.platform === "win32"
        ? 'powershell -c "irm bun.sh/install.ps1 | iex"'
        : "curl -fsSL https://bun.sh/install | bash";
    case "npm":
      switch (environment.platform) {
        case "darwin":
          return "brew install node";
        case "win32":
          return "winget install OpenJS.NodeJS.LTS";
        case "linux":
        default:
          return "nvm install --lts";
      }
    default:
      return undefined;
  }
}

export function packageManagerInstallCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case "pnpm":
      return "pnpm install";
    case "yarn":
      return "yarn install";
    case "bun":
      return "bun install";
    case "npm":
    default:
      return "npm install";
  }
}

export function packageManagerCiInstallCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case "pnpm":
      return "pnpm install --frozen-lockfile";
    case "yarn":
      return "yarn install --immutable";
    case "bun":
      return "bun install --frozen-lockfile";
    case "npm":
    default:
      return "npm ci";
  }
}

export function packageManagerRunCommand(
  packageManager: PackageManager,
  script: string,
): string {
  switch (packageManager) {
    case "yarn":
      return `yarn ${script}`;
    case "bun":
      return `bun run ${script}`;
    case "pnpm":
      return `pnpm run ${script}`;
    case "npm":
    default:
      return `npm run ${script}`;
  }
}

export function packageManagerScriptInvocation(
  packageManager: PackageManager,
  script: string,
  extraArgs: string[] = [],
): { command: string; args: string[] } {
  switch (packageManager) {
    case "yarn":
      return {
        command: "yarn",
        args: [script, ...extraArgs],
      };
    case "bun":
      return {
        command: "bun",
        args: ["run", script, ...(extraArgs.length > 0 ? ["--", ...extraArgs] : [])],
      };
    case "pnpm":
      return {
        command: "pnpm",
        args: ["run", script, ...(extraArgs.length > 0 ? ["--", ...extraArgs] : [])],
      };
    case "npm":
    default:
      return {
        command: "npm",
        args: ["run", script, ...(extraArgs.length > 0 ? ["--", ...extraArgs] : [])],
      };
  }
}

export function getSupportedPackageManagers(
  intent: ProjectIntent,
  architecture: ArchitectureMode,
): PackageManager[] {
  if (architecture === "monorepo" || architecture === "microfrontend") {
    return ["npm", "pnpm", "yarn"];
  }

  if (intent === "microfrontend-system") {
    return ["npm", "pnpm", "yarn"];
  }

  if (intent === "backend-api" || intent === "fullstack-app" || intent === "chrome-extension" || intent === "cli-tool") {
    return ["npm", "pnpm", "yarn"];
  }

  return ALL_PACKAGE_MANAGERS;
}

export function getSupportedFrontendFrameworks(
  packageManager: PackageManager,
  architecture: ArchitectureMode,
): FrontendFramework[] {
  const allFrameworks: FrontendFramework[] = [
    "nextjs",
    "react-vite",
    "astro",
    "remix",
    "angular",
    "nuxt",
    "vue-vite",
    "sveltekit",
    "svelte",
    "solidjs",
  ];

  if (architecture === "microfrontend") {
    return ["react-vite"];
  }

  if (packageManager === "bun") {
    return allFrameworks.filter((framework) => BUN_SUPPORTED_FRONTEND_FRAMEWORKS.has(framework));
  }

  return allFrameworks;
}

export function getSupportedRenderingModes(
  framework: FrontendFramework,
  architecture: ArchitectureMode,
): FrontendRenderingMode[] {
  if (architecture === "microfrontend") {
    return ["client"];
  }

  return SUPPORTED_RENDERING_MODES[framework];
}

export function getDefaultRenderingMode(
  framework: FrontendFramework,
  intent: ProjectIntent,
  architecture: ArchitectureMode,
): FrontendRenderingMode {
  const supportedModes = getSupportedRenderingModes(framework, architecture);

  if (intent === "landing-page") {
    if (supportedModes.includes("static")) {
      return "static";
    }

    if (supportedModes.includes("ssg")) {
      return "ssg";
    }
  }

  if (supportedModes.includes("client")) {
    return "client";
  }

  return supportedModes[0] ?? "client";
}

export function getSupportedUiLibraries(framework: FrontendFramework): UiLibrary[] {
  if (REACT_FAMILY_FRAMEWORKS.has(framework)) {
    return ALL_UI_LIBRARIES;
  }

  return ["none"];
}

export function getSupportedStateChoices(
  framework: FrontendFramework,
  intent: ProjectIntent,
): StateChoice[] {
  if (intent === "landing-page") {
    return ["none"];
  }

  if (REACT_FAMILY_FRAMEWORKS.has(framework)) {
    return ALL_STATE_CHOICES;
  }

  return ["none"];
}

export function getSupportedStateChoicesForDataFetching(
  framework: FrontendFramework,
  intent: ProjectIntent,
  dataFetching: DataFetchingChoice,
): StateChoice[] {
  const supported = getSupportedStateChoices(framework, intent);

  if (dataFetching === "rtk-query") {
    return supported.filter((choice) => choice === "redux" || choice === "redux-toolkit");
  }

  return supported;
}

export function getSupportedDataFetchingChoices(
  framework: FrontendFramework,
  intent: ProjectIntent,
): DataFetchingChoice[] {
  if (intent === "landing-page") {
    return ["native-fetch"];
  }

  if (REACT_FAMILY_FRAMEWORKS.has(framework)) {
    return ALL_DATA_FETCHING_CHOICES;
  }

  if (VUE_FAMILY_FRAMEWORKS.has(framework)) {
    return ["native-fetch", "tanstack-query", "apollo-client", "none"];
  }

  return ["native-fetch", "none"];
}

export function getSupportedDataFetchingChoicesForState(
  framework: FrontendFramework,
  intent: ProjectIntent,
  state: StateChoice,
): DataFetchingChoice[] {
  const supported = getSupportedDataFetchingChoices(framework, intent);

  if (supported.includes("rtk-query") && state !== "redux" && state !== "redux-toolkit") {
    return supported.filter((choice) => choice !== "rtk-query");
  }

  return supported;
}

export function getSupportedBackendLanguages(
  framework: BackendFramework,
): BackendLanguage[] {
  if (framework === "nestjs") {
    return ["typescript"];
  }

  return ["typescript", "javascript"];
}

export function getSupportedTestRunners(plan: ProjectPlan): TestRunner[] {
  if (plan.intent === "chrome-extension") {
    return ["vitest", "jest"];
  }

  if (!hasFrontendLikeSurface(plan)) {
    return ["vitest", "jest"];
  }

  return ["vitest", "jest", "playwright", "cypress"];
}

export function chooseSupportedPackageManager(
  plan: ProjectPlan,
  environment: EnvironmentInfo,
): PackageManager {
  const supported = getSupportedPackageManagers(plan.intent, plan.architecture);

  if (supported.includes(plan.packageManager)) {
    return plan.packageManager;
  }

  if (supported.includes(environment.recommendedPackageManager)) {
    return environment.recommendedPackageManager;
  }

  const installedSupported = supported.find(
    (packageManager) => environment.packageManagers[packageManager].installed,
  );

  return installedSupported ?? supported[0] ?? "npm";
}

export function getPrimaryScriptNames(
  plan: ProjectPlan,
): { dev?: string; build?: string; check?: string; test?: string } {
  return {
    dev: "dev",
    build: "build",
    check: "check",
    test:
      plan.testing.enabled && (plan.testing.runner === "playwright" || plan.testing.runner === "cypress")
        ? "test:e2e"
        : plan.testing.enabled
          ? "test"
          : undefined,
  };
}

export function getDefaultLocalUrl(plan: ProjectPlan): string | undefined {
  if (plan.architecture === "microfrontend") {
    return "http://127.0.0.1:4173";
  }

  if (plan.intent === "backend-api") {
    return "http://localhost:3001/health";
  }

  if (plan.intent === "fullstack-app") {
    return plan.frontend?.framework === "nextjs"
      ? "http://localhost:3000"
      : "http://localhost:5173";
  }

  if (plan.intent === "chrome-extension") {
    return undefined;
  }

  if (plan.intent === "cli-tool") {
    return undefined;
  }

  switch (plan.frontend?.framework) {
    case "nextjs":
    case "remix":
    case "nuxt":
      return "http://localhost:3000";
    case "astro":
      return "http://localhost:4321";
    case "angular":
      return "http://localhost:4200";
    case "react-vite":
    case "vue-vite":
    case "svelte":
    case "sveltekit":
    case "solidjs":
    default:
      return "http://localhost:5173";
  }
}

export function getGenericPrerequisites(plan: ProjectPlan): AdvisoryItem[] {
  const requiredBeforeRun: AdvisoryItem[] = [];

  if (plan.nodeStrategy === "custom" && plan.customNodeVersion) {
    requiredBeforeRun.push({
      title: "Use the selected Node.js version",
      detail: `This scaffold was configured for Node.js ${plan.customNodeVersion}. Switch your local Node version before running install, build, or dev commands if your shell is using a different version.`,
      command: "nvm use",
    });
  }

  if (plan.testing.enabled && plan.testing.runner === "playwright") {
    requiredBeforeRun.push({
      title: "Install Playwright browsers",
      detail: "Playwright ships the test runner in node_modules, but browser binaries are installed separately on each machine.",
      command: "npx playwright install",
    });
  }

  if (plan.packageManager === "bun") {
    requiredBeforeRun.unshift({
      title: "Install Bun on each machine that uses this project",
      detail: "This scaffold uses Bun for dependency installation and package scripts. Install Bun locally before running the generated Bun commands on another machine.",
    });
  }

  return requiredBeforeRun;
}

export function getStackNotes(plan: ProjectPlan): string[] {
  const notes: string[] = [];
  const defaultUrl = getDefaultLocalUrl(plan);

  if (plan.intent === "backend-api") {
    notes.push(`The generated API exposes a health endpoint at ${defaultUrl}.`);
  }

  if (plan.intent === "fullstack-app") {
    if (plan.frontend?.framework === "nextjs") {
      notes.push("The generated Next.js app serves both the UI and API routes from the same app server.");
      notes.push("Use `/api/health` to verify the API surface after the dev server is running.");
    } else {
      notes.push("The root dev command starts both the frontend and API processes together.");
      notes.push("The generated API exposes a health endpoint at http://localhost:3001/health.");
    }
  }

  if (plan.intent === "chrome-extension") {
    notes.push("Build the project and load the generated `dist/` directory as an unpacked extension in your browser.");
  }

  if (plan.intent === "cli-tool") {
    notes.push("The dev command runs the source entrypoint directly, while the build command emits the compiled CLI under `dist/src`.");
  }

  if (plan.architecture === "monorepo") {
    notes.push("The root commands orchestrate all apps and shared packages from one workspace entrypoint.");
  }

  if (plan.architecture === "microfrontend") {
    notes.push("The root dev command starts the host and remotes together.");
    notes.push("The host runs on http://127.0.0.1:4173 and the default remotes expose entries on ports 4174 and 4175.");
  }

  if (hasFrontendLikeSurface(plan) && defaultUrl && plan.architecture !== "microfrontend") {
    notes.push(`Open ${defaultUrl} after starting the dev server to inspect the generated starter surface.`);
  }

  return notes;
}

export function buildTemplateGuidance(plan: ProjectPlan): PostCreateGuidance {
  const scripts = getPrimaryScriptNames(plan);
  const nextCommands = [
    packageManagerInstallCommand(plan.packageManager),
    scripts.dev ? packageManagerRunCommand(plan.packageManager, scripts.dev) : undefined,
    scripts.build ? packageManagerRunCommand(plan.packageManager, scripts.build) : undefined,
    scripts.check ? packageManagerRunCommand(plan.packageManager, scripts.check) : undefined,
    scripts.test ? packageManagerRunCommand(plan.packageManager, scripts.test) : undefined,
  ].filter(Boolean) as string[];

  const recommended: AdvisoryItem[] = [
    {
      title: "Review the generated docs",
      detail: "Start with `docs/getting-started.md` and `docs/architecture.md` before replacing the starter content.",
    },
  ];

  if (plan.tooling.docker) {
    recommended.push({
      title: "Install Docker before using container workflows",
      detail: "The scaffold includes Docker assets, but Docker Desktop or Docker Engine must be installed separately on each machine that will build or run the container image.",
    });
  }

  return {
    nextCommands,
    requiredBeforeRun: getGenericPrerequisites(plan),
    recommended,
    stackNotes: getStackNotes(plan),
  };
}

export function buildRuntimeGuidance(
  plan: ProjectPlan,
  environment: EnvironmentInfo,
  installResult: InstallResult,
  cwd: string,
): PostCreateGuidance {
  const templateGuidance = buildTemplateGuidance(plan);
  const requiredBeforeRun = [...templateGuidance.requiredBeforeRun];
  const recommended = [...templateGuidance.recommended];

  if (
    plan.nodeStrategy === "custom" &&
    plan.customNodeVersion &&
    !environment.nodeVersion.toLowerCase().includes(plan.customNodeVersion.toLowerCase())
  ) {
    requiredBeforeRun.unshift({
      title: "Switch Node.js versions",
      detail: `Your shell is currently using ${environment.nodeVersion}, but this project was configured for Node.js ${plan.customNodeVersion}.`,
      command: platformScopedNodeSetupCommand(environment.platform, plan.customNodeVersion),
    });
  }

  if (!environment.packageManagers[plan.packageManager].installed) {
    requiredBeforeRun.unshift({
      title: `Install or enable ${plan.packageManager}`,
      detail: `${plan.packageManager} was selected for this project, but it is not currently available in your shell. Install or enable it before using the generated ${plan.packageManager} commands.`,
      command: platformScopedPackageManagerInstallCommand(
        plan.packageManager,
        environment,
      ),
    });
  }

  for (const item of requiredBeforeRun) {
    if (
      (item.title === "Use the selected Node.js version" ||
        item.title === "Switch Node.js versions") &&
      plan.customNodeVersion
    ) {
      item.command = platformScopedNodeSetupCommand(
        environment.platform,
        plan.customNodeVersion,
      );
    }

    if (item.title === "Install Playwright browsers") {
      item.command = platformScopedPlaywrightInstallCommand(environment.platform);
    }
  }

  if ((plan.git.initialize || plan.git.addRemote || plan.tooling.husky) && !hasSystemTool(environment, "git")) {
    recommended.unshift({
      title: "Install Git to use the requested repository tooling",
      detail: "This scaffold was configured to initialize or work with a Git repository, but Git is not currently available in your shell.",
      command: platformScopedGitInstallCommand(environment.platform),
    });
  }

  if (plan.tooling.docker && !hasSystemTool(environment, "docker")) {
    recommended.push({
      title: "Install Docker to use the generated container assets",
      detail: "Docker support was selected for this scaffold, but Docker is not currently available in your shell.",
      command: platformScopedDockerInstallCommand(environment.platform),
    });
  }

  if (!installResult.dependencyInstall.succeeded) {
    requiredBeforeRun.unshift({
      title: "Install project dependencies",
      detail:
        installResult.dependencyInstall.failureReason ??
        "Dependencies were not installed successfully during project creation.",
      command: packageManagerInstallCommand(plan.packageManager),
    });
  }

  const nextCommands = installResult.dependencyInstall.succeeded
    ? [
        plan.targetDir !== cwd ? `cd ${plan.targetDir}` : undefined,
        ...templateGuidance.nextCommands.filter(
          (command) => command !== packageManagerInstallCommand(plan.packageManager),
        ),
      ].filter(Boolean) as string[]
    : [];

  recommended.push({
    title: "Read the generated quick-start docs",
    detail: "The project README and `docs/getting-started.md` include the same commands and one-time setup notes for this scaffold.",
  });

  return {
    nextCommands,
    requiredBeforeRun,
    recommended,
    stackNotes: templateGuidance.stackNotes,
  };
}
