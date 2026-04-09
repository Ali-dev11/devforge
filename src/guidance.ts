import type {
  AdvisoryItem,
  ArchitectureMode,
  BackendFramework,
  BackendLanguage,
  DeploymentProfile,
  DeploymentTarget,
  DeploymentVariable,
  EnvironmentInfo,
  FrontendFramework,
  FrontendRenderingMode,
  InstallResult,
  PackageManager,
  PostCreateGuidance,
  ProjectIntent,
  ProjectPlan,
  TestEnvironment,
  TestRunner,
  UiLibrary,
  StateChoice,
  DataFetchingChoice,
} from "./types.js";
import { REACT_FAMILY_FRAMEWORKS, VUE_FAMILY_FRAMEWORKS } from "./constants.js";
import {
  canUsePackageManager,
  hasFrontendLikeSurface,
  hasSystemTool,
  platformScopedDockerInstallCommand,
  platformScopedGitInstallCommand,
  platformScopedNodeSetupCommand,
  platformScopedPackageManagerInstallCommand,
  platformScopedPlaywrightInstallCommand,
  preferredNodeVersionForPlan,
} from "./remediation.js";
import {
  isNodeVersionSupportedForPlan,
  minimumSupportedNodeVersionHint,
} from "./utils/node-compat.js";
import { joinSentence, toTitleCase } from "./utils/strings.js";

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

export function deploymentTargetLabel(target: DeploymentTarget): string {
  switch (target) {
    case "vercel":
      return "Vercel";
    case "netlify":
      return "Netlify";
    case "render":
      return "Render";
    case "railway":
      return "Railway";
    case "docker-compose":
      return "Docker Compose";
    case "none":
    default:
      return "None";
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

function deploymentPortForPlan(plan: ProjectPlan): number | undefined {
  if (plan.intent === "backend-api") {
    return plan.deployment.port ?? 3001;
  }

  if (plan.frontend?.framework === "nextjs") {
    return plan.deployment.port ?? 3000;
  }

  return plan.deployment.port;
}

function deploymentHealthPathForPlan(plan: ProjectPlan): string | undefined {
  if (plan.deployment.healthPath) {
    return plan.deployment.healthPath;
  }

  if (plan.intent === "backend-api") {
    return "/health";
  }

  if (plan.frontend?.framework === "nextjs") {
    return "/";
  }

  return undefined;
}

function makeDeploymentVariable(
  name: string,
  description: string,
  options: { example?: string; secret?: boolean } = {},
): DeploymentVariable {
  return {
    name,
    description,
    example: options.example,
    secret: options.secret,
  };
}

export function getDeploymentProfile(
  plan: ProjectPlan,
): DeploymentProfile | undefined {
  const buildCommand = packageManagerRunCommand(plan.packageManager, "build");
  const startCommand =
    plan.intent === "backend-api" || plan.frontend?.framework === "nextjs"
      ? packageManagerRunCommand(plan.packageManager, "start")
      : undefined;
  const port = deploymentPortForPlan(plan);
  const healthPath = deploymentHealthPathForPlan(plan);

  switch (plan.deployment.target) {
    case "vercel":
      return {
        target: "vercel",
        label: "Vercel",
        category: plan.frontend?.framework === "react-vite" ? "static-site" : "managed-node",
        buildCommand,
        outputDirectory: plan.frontend?.framework === "react-vite" ? "dist" : undefined,
        generatedFiles: ["vercel.json", ...(plan.tooling.githubActions ? [".github/workflows/deploy.yml"] : [])],
        secrets: [
          makeDeploymentVariable("VERCEL_TOKEN", "Vercel access token for CI or manual deploy workflows.", {
            secret: true,
          }),
          makeDeploymentVariable("VERCEL_ORG_ID", "Vercel team or account identifier used by the generated workflow.", {
            secret: true,
          }),
          makeDeploymentVariable("VERCEL_PROJECT_ID", "Vercel project identifier used by the generated workflow.", {
            secret: true,
          }),
        ],
        environmentVariables: [],
      };
    case "netlify":
      return {
        target: "netlify",
        label: "Netlify",
        category: "static-site",
        buildCommand,
        outputDirectory: "dist",
        generatedFiles: ["netlify.toml", ...(plan.tooling.githubActions ? [".github/workflows/deploy.yml"] : [])],
        secrets: [
          makeDeploymentVariable("NETLIFY_AUTH_TOKEN", "Netlify token for CI or manual deploy workflows.", {
            secret: true,
          }),
          makeDeploymentVariable("NETLIFY_SITE_ID", "Netlify site identifier used by the generated workflow.", {
            secret: true,
          }),
        ],
        environmentVariables: [],
      };
    case "render":
      return {
        target: "render",
        label: "Render",
        category: plan.frontend?.framework === "react-vite" ? "static-site" : "managed-node",
        port,
        healthPath,
        buildCommand,
        startCommand,
        outputDirectory: plan.frontend?.framework === "react-vite" ? "dist" : undefined,
        generatedFiles: ["render.yaml", ...(plan.tooling.githubActions ? [".github/workflows/deploy.yml"] : [])],
        secrets: [
          makeDeploymentVariable(
            "RENDER_DEPLOY_HOOK_URL",
            "Render deploy hook URL used by the generated GitHub Actions workflow.",
            { secret: true },
          ),
        ],
        environmentVariables: [
          ...(plan.frontend?.framework === "react-vite"
            ? [makeDeploymentVariable("NODE_VERSION", "Node.js version used during Render builds.", {
                example: "22.12.0",
              })]
            : [
                makeDeploymentVariable("NODE_VERSION", "Node.js version used by Render for build and runtime parity.", {
                  example: "22.12.0",
                }),
                ...(port
                  ? [makeDeploymentVariable("PORT", "Port expected by the Render web service.", {
                      example: String(port),
                    })]
                  : []),
                makeDeploymentVariable("HOST", "Bind address for containerized runtime processes.", {
                  example: "0.0.0.0",
                }),
              ]),
        ],
      };
    case "railway":
      return {
        target: "railway",
        label: "Railway",
        category: "managed-node",
        port,
        healthPath,
        buildCommand,
        startCommand,
        generatedFiles: ["railway.toml", ...(plan.tooling.githubActions ? [".github/workflows/deploy.yml"] : [])],
        secrets: [
          makeDeploymentVariable("RAILWAY_TOKEN", "Railway project token used by the generated GitHub Actions workflow.", {
            secret: true,
          }),
          makeDeploymentVariable("RAILWAY_PROJECT_ID", "Railway project identifier for CI deploys.", {
            secret: true,
          }),
          makeDeploymentVariable("RAILWAY_ENVIRONMENT_NAME", "Railway environment name or id used by the CI workflow.", {
            secret: true,
          }),
          makeDeploymentVariable("RAILWAY_SERVICE_NAME", "Railway service name to deploy from CI.", {
            secret: true,
          }),
        ],
        environmentVariables: [
          ...(port
            ? [makeDeploymentVariable("PORT", "Port expected by the Railway runtime.", {
                example: String(port),
              })]
            : []),
          makeDeploymentVariable("HOST", "Bind address for the generated runtime server.", {
            example: "0.0.0.0",
          }),
        ],
      };
    case "docker-compose":
      return {
        target: "docker-compose",
        label: "Docker Compose",
        category: "container",
        port,
        healthPath,
        buildCommand,
        startCommand,
        generatedFiles: [
          "docker-compose.yml",
          "Dockerfile",
          ...(plan.tooling.githubActions ? [".github/workflows/deploy.yml"] : []),
        ],
        secrets: [],
        environmentVariables: [
          ...(port
            ? [makeDeploymentVariable("PORT", "Port exposed by the generated container.", {
                example: String(port),
              })]
            : []),
          makeDeploymentVariable("NODE_ENV", "Runtime mode for containerized app processes.", {
            example: "production",
          }),
        ],
      };
    case "none":
    default:
      return undefined;
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

export function getSupportedDeploymentTargets(
  plan: ProjectPlan,
): DeploymentTarget[] {
  const targets: DeploymentTarget[] = ["none"];

  if (
    plan.intent === "frontend-app" &&
    plan.architecture === "simple" &&
    plan.frontend?.framework === "react-vite"
  ) {
    targets.push("vercel", "netlify", "render");
  }

  if (
    plan.intent === "frontend-app" &&
    plan.architecture === "simple" &&
    plan.frontend?.framework === "nextjs"
  ) {
    targets.push("vercel", "render", "railway");
  }

  if (
    plan.intent === "backend-api" &&
    plan.architecture !== "monorepo" &&
    plan.backend &&
    ["express", "fastify", "hono"].includes(plan.backend.framework)
  ) {
    targets.push("docker-compose", "render", "railway");
  }

  return targets;
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

export function getSupportedTestEnvironments(
  plan: ProjectPlan,
  runner: TestRunner,
): TestEnvironment[] {
  if (runner === "playwright" || runner === "cypress") {
    return ["browser-e2e"];
  }

  if (!plan.frontend && plan.intent !== "chrome-extension") {
    return ["node"];
  }

  if (runner === "jest") {
    return ["node", "jsdom"];
  }

  return ["node", "jsdom", "happy-dom"];
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

function selectedBackendCapabilityBaselines(plan: ProjectPlan): string[] {
  if (!plan.backend) {
    return [];
  }

  const baselines: string[] = [];

  if (plan.backend.auth.includes("jwt")) {
    baselines.push("JWT auth");
  }

  if (plan.backend.auth.includes("oauth")) {
    baselines.push("OAuth");
  }

  if (plan.backend.database !== "none") {
    baselines.push(`${toTitleCase(plan.backend.database)} database wiring`);
  }

  if (plan.backend.orm !== "none") {
    baselines.push(`${toTitleCase(plan.backend.orm)} data layer`);
  }

  if (plan.backend.redis) {
    baselines.push("Redis integration");
  }

  if (plan.backend.swagger) {
    baselines.push("Swagger");
  }

  if (plan.backend.websockets) {
    baselines.push("WebSockets");
  }

  return baselines;
}

export function getStackNotes(plan: ProjectPlan): string[] {
  const notes: string[] = [];
  const defaultUrl = getDefaultLocalUrl(plan);
  const deploymentProfile = getDeploymentProfile(plan);
  const backendCapabilityBaselines = selectedBackendCapabilityBaselines(plan);

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

  if (deploymentProfile) {
    notes.push(
      `The scaffold includes a ${deploymentProfile.label} deployment baseline. Review the generated deployment files before using them in production.`,
    );
    if (deploymentProfile.healthPath) {
      notes.push(
        `Deployment health checks are expected to pass on ${deploymentProfile.healthPath}. Keep that route stable when you start customizing the app.`,
      );
    }
  }

  if (backendCapabilityBaselines.length > 0) {
    notes.push(
      `Selected backend capabilities are starter baselines, not full implementations: ${joinSentence(
        backendCapabilityBaselines,
      )}. Finish the actual modules, providers, configuration, and runtime integration before treating them as production-ready.`,
    );
  }

  return notes;
}

export function buildTemplateGuidance(plan: ProjectPlan): PostCreateGuidance {
  const scripts = getPrimaryScriptNames(plan);
  const deploymentProfile = getDeploymentProfile(plan);
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

  if (plan.deployment.target === "docker-compose") {
    recommended.push({
      title: "Validate the Docker Compose baseline before shipping",
      detail: "Run the generated compose stack locally first so you can confirm ports, environment variables, and image startup behavior before wiring a real server.",
      command: "docker compose up --build",
    });
  }

  if (plan.deployment.target === "vercel") {
    recommended.push({
      title: "Configure Vercel project secrets before using the deployment workflow",
      detail: "Set `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` in your GitHub repository or deployment environment before running the generated Vercel workflow.",
    });
  }

  if (plan.deployment.target === "netlify") {
    recommended.push({
      title: "Configure Netlify credentials before using the deployment workflow",
      detail: "Set `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` before triggering the generated Netlify deploy workflow.",
    });
  }

  if (plan.deployment.target === "render") {
    recommended.push({
      title: "Configure Render deploy access before using the deployment workflow",
      detail: "Set `RENDER_DEPLOY_HOOK_URL` before triggering the generated Render workflow, then validate the generated `render.yaml` against your Render workspace settings.",
    });
  }

  if (plan.deployment.target === "railway") {
    recommended.push({
      title: "Configure Railway project identifiers before using the deployment workflow",
      detail: "Set `RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`, `RAILWAY_ENVIRONMENT_NAME`, and `RAILWAY_SERVICE_NAME` before triggering the generated Railway workflow.",
    });
  }

  if (deploymentProfile?.environmentVariables.length) {
    recommended.push({
      title: "Review deployment environment variables before first deploy",
      detail: `The generated ${deploymentProfile.label} baseline expects ${joinSentence(
        deploymentProfile.environmentVariables.map((variable) => `\`${variable.name}\``),
      )}. Mirror those values in your provider dashboard before treating the deployment config as production-ready.`,
    });
  }

  const backendCapabilityBaselines = selectedBackendCapabilityBaselines(plan);
  if (backendCapabilityBaselines.length > 0) {
    recommended.push({
      title: "Finish backend capability baselines before shipping",
      detail: `This scaffold adds starter wiring for ${joinSentence(
        backendCapabilityBaselines,
      )}, but you still need to implement the real modules, configuration, guards, adapters, persistence, and integration paths for your application.`,
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
  const currentNodeSupported = isNodeVersionSupportedForPlan(plan, environment.nodeVersion);

  if (
    plan.nodeStrategy === "custom" &&
    plan.customNodeVersion &&
    currentNodeSupported &&
    !environment.nodeVersion.toLowerCase().includes(plan.customNodeVersion.toLowerCase())
  ) {
    requiredBeforeRun.unshift({
      title: "Switch Node.js versions",
      detail: `Your shell is currently using ${environment.nodeVersion}, but this project was configured for Node.js ${plan.customNodeVersion}.`,
      command: platformScopedNodeSetupCommand(environment, plan.customNodeVersion),
    });
  }

  if (!currentNodeSupported) {
    requiredBeforeRun.unshift({
      title: "Use a compatible Node.js version",
      detail: `Your shell is currently using ${environment.nodeVersion}, but this scaffold requires Node.js ${minimumSupportedNodeVersionHint(plan)} before install, build, or dev commands will work reliably.`,
      command: platformScopedNodeSetupCommand(environment, preferredNodeVersionForPlan(plan)),
    });
  }

  if (
    requiredBeforeRun.some(
      (item) => item.title === "Use a compatible Node.js version" || item.title === "Switch Node.js versions",
    )
  ) {
    const genericNodeIndex = requiredBeforeRun.findIndex(
      (item) => item.title === "Use the selected Node.js version",
    );
    if (genericNodeIndex >= 0) {
      requiredBeforeRun.splice(genericNodeIndex, 1);
    }
  }

  const packageManagerReady = canUsePackageManager(environment, plan.packageManager);

  if (!packageManagerReady) {
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
      item.command = platformScopedNodeSetupCommand(environment, plan.customNodeVersion);
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

  const nextCommands = installResult.dependencyInstall.succeeded && currentNodeSupported && packageManagerReady
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
