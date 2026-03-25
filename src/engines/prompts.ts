import prompts from "prompts";
import { basename, resolve } from "node:path";
import {
  AI_TOOL_CHOICES,
  ARCHITECTURE_CHOICES,
  AUTH_CHOICES,
  BACKEND_FRAMEWORK_CHOICES,
  DATA_FETCHING_CHOICES,
  DATABASE_CHOICES,
  DEFAULT_REMOTE_APPS,
  DEFAULT_RULE_CATEGORIES,
  EXTENSION_FLAVOR_CHOICES,
  FRONTEND_FRAMEWORK_CHOICES,
  FRONTEND_RENDERING_CHOICES,
  LICENSE_CHOICES,
  MICROFRONTEND_STRATEGY_CHOICES,
  ORM_CHOICES,
  PACKAGE_MANAGER_CHOICES,
  PROJECT_INTENT_CHOICES,
  RULE_CATEGORY_CHOICES,
  RULE_MODE_CHOICES,
  STATE_CHOICES,
  STRICTNESS_CHOICES,
  STYLING_CHOICES,
  TEMPLATE_TIER_CHOICES,
  TEST_ENVIRONMENT_CHOICES,
  TEST_RUNNER_CHOICES,
  UI_LIBRARY_CHOICES,
  WORKSPACE_TOOL_CHOICES,
} from "../constants.js";
import type {
  AiConfig,
  ArchitectureMode,
  BackendConfig,
  CliOptions,
  ChromeExtensionConfig,
  EnvironmentInfo,
  FrontendConfig,
  ProjectIntent,
  ProjectPlan,
  TestingConfig,
  ToolingConfig,
} from "../types.js";
import { getAvailableRuleCategories } from "./decision.js";
import { dedupe, slugifyProjectName } from "../utils/strings.js";

function cancelHandler(): never {
  throw new Error("Prompt cancelled.");
}

function defaultTooling(): ToolingConfig {
  return {
    eslint: true,
    eslintProfile: "moderate",
    prettier: true,
    prettierProfile: "moderate",
    husky: true,
    huskyProfile: "moderate",
    commitlint: true,
    docker: false,
    githubActions: true,
  };
}

function defaultFrontendConfig(intent: ProjectIntent): FrontendConfig {
  if (intent === "landing-page") {
    return {
      framework: "react-vite",
      rendering: "static",
      styling: "tailwind-css",
      uiLibrary: "shadcn-ui",
      state: "none",
      dataFetching: "native-fetch",
    };
  }

  return {
    framework: "react-vite",
    rendering: "client",
    styling: "tailwind-css",
    uiLibrary: "shadcn-ui",
    state: "zustand",
    dataFetching: "tanstack-query",
  };
}

function defaultBackendConfig(): BackendConfig {
  return {
    framework: "hono",
    language: "typescript",
    auth: [],
    orm: "none",
    database: "none",
    redis: false,
    swagger: true,
    websockets: false,
  };
}

function defaultAiConfig(): AiConfig {
  return {
    tools: ["cursor", "claude", "codex"],
    ruleMode: "balanced",
    categories: DEFAULT_RULE_CATEGORIES,
  };
}

function defaultExtensionConfig(): ChromeExtensionConfig {
  return {
    flavor: "react",
    includesBackground: true,
    includesContent: true,
    includesPopup: true,
    manifestVersion: "v3",
  };
}

function defaultTestingConfig(intent: ProjectIntent): TestingConfig {
  if (intent === "backend-api" || intent === "cli-tool") {
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

export function buildDefaultPlan(
  environment: EnvironmentInfo,
  options: CliOptions,
  seed?: ProjectPlan,
): ProjectPlan {
  if (seed) {
    return {
      ...seed,
      targetDir: options.outputDir ? resolve(process.cwd(), options.outputDir) : seed.targetDir,
    };
  }

  const rawName =
    options.projectName ??
    basename(options.outputDir ?? process.cwd()) ??
    "devforge-app";
  const projectName = slugifyProjectName(rawName) || "devforge-app";
  const targetDir = resolve(process.cwd(), options.outputDir ?? projectName);

  return {
    schemaVersion: 1,
    projectName,
    targetDir,
    nodeStrategy: "lts",
    packageManager: environment.recommendedPackageManager,
    intent: "frontend-app",
    architecture: "simple",
    templateTier: "starter",
    frontend: defaultFrontendConfig("frontend-app"),
    workspace: {
      tool: "turborepo",
      remoteApps: DEFAULT_REMOTE_APPS,
    },
    extension: defaultExtensionConfig(),
    ai: defaultAiConfig(),
    tooling: defaultTooling(),
    testing: defaultTestingConfig("frontend-app"),
    git: {
      initialize: true,
      setupSsh: false,
      addRemote: false,
    },
    metadata: {
      description: "Generated with DevForge CLI",
      license: "MIT",
      generateReadme: true,
      generateEnvExample: true,
    },
  };
}

function needsFrontend(intent: ProjectIntent): boolean {
  return [
    "landing-page",
    "frontend-app",
    "fullstack-app",
    "microfrontend-system",
  ].includes(intent);
}

function needsBackend(intent: ProjectIntent): boolean {
  return ["backend-api", "fullstack-app"].includes(intent);
}

function needsChromeExtension(intent: ProjectIntent): boolean {
  return intent === "chrome-extension";
}

function getInitialChoiceIndex<T extends { value: string }>(
  choices: T[],
  currentValue: string | undefined,
): number {
  const index = choices.findIndex((choice) => choice.value === currentValue);
  return index >= 0 ? index : 0;
}

function withSelected<T extends { title: string; value: string }>(
  choices: T[],
  selectedValues: string[],
): Array<T & { selected: boolean }> {
  return choices.map((choice) => ({
    ...choice,
    selected: selectedValues.includes(choice.value),
  }));
}

export function getArchitectureChoicesForIntent(
  intent: ProjectIntent,
): Array<{ title: string; value: ArchitectureMode }> {
  if (intent === "microfrontend-system") {
    return ARCHITECTURE_CHOICES.filter((choice) => choice.value === "microfrontend");
  }

  if (intent === "chrome-extension") {
    return ARCHITECTURE_CHOICES.filter((choice) => choice.value === "modular");
  }

  if (intent === "backend-api" || intent === "cli-tool") {
    return ARCHITECTURE_CHOICES.filter((choice) => choice.value !== "microfrontend");
  }

  return ARCHITECTURE_CHOICES;
}

export function applyIntentDefaults(plan: ProjectPlan): ProjectPlan {
  if (needsFrontend(plan.intent)) {
    plan.frontend ??= defaultFrontendConfig(plan.intent);

    if (plan.intent === "landing-page") {
      plan.frontend.state = "none";
      plan.frontend.dataFetching = "native-fetch";
    }
  } else {
    delete plan.frontend;
  }

  if (needsBackend(plan.intent)) {
    plan.backend ??= defaultBackendConfig();
  } else {
    delete plan.backend;
  }

  if (needsChromeExtension(plan.intent)) {
    plan.extension ??= defaultExtensionConfig();
  } else {
    delete plan.extension;
  }

  const allowedArchitectures = getArchitectureChoicesForIntent(plan.intent);
  if (!allowedArchitectures.some((choice) => choice.value === plan.architecture)) {
    plan.architecture = allowedArchitectures[0]?.value ?? "simple";
  }

  return plan;
}

export async function collectProjectPlan(
  environment: EnvironmentInfo,
  options: CliOptions,
  seed?: ProjectPlan,
): Promise<ProjectPlan> {
  const base = buildDefaultPlan(environment, options, seed);

  if (options.yes) {
    return base;
  }

  const setupAnswers = await prompts(
    [
      {
        type: "text",
        name: "projectName",
        message: "Project name",
        initial: base.projectName,
        validate: (value: string) =>
          slugifyProjectName(value).length > 0 ? true : "Use letters, numbers, spaces, - or _.",
      },
      {
        type: "text",
        name: "targetDir",
        message: "Output directory",
        initial: base.targetDir,
      },
      {
        type: "select",
        name: "nodeStrategy",
        message: "Node.js version",
        choices: [
          { title: "LTS", value: "lts" },
          { title: "Latest", value: "latest" },
          { title: "Custom", value: "custom" },
        ],
        initial: getInitialChoiceIndex(
          [
            { title: "LTS", value: "lts" },
            { title: "Latest", value: "latest" },
            { title: "Custom", value: "custom" },
          ],
          base.nodeStrategy,
        ),
      },
      {
        type: (prev: string) => (prev === "custom" ? "text" : null),
        name: "customNodeVersion",
        message: "Custom Node.js version",
        initial: base.customNodeVersion ?? "22.0.0",
      },
      {
        type: "select",
        name: "packageManager",
        message: "Package manager",
        choices: PACKAGE_MANAGER_CHOICES.map((choice) => ({
          title: `${choice.title}${environment.packageManagers[choice.value].installed ? "" : " (not installed)"}`,
          value: choice.value,
        })),
        initial: getInitialChoiceIndex(PACKAGE_MANAGER_CHOICES, base.packageManager),
      },
      {
        type: "select",
        name: "intent",
        message: "What are you building?",
        choices: PROJECT_INTENT_CHOICES,
        initial: getInitialChoiceIndex(PROJECT_INTENT_CHOICES, base.intent),
      },
    ],
    { onCancel: cancelHandler },
  );

  const selectedIntent = setupAnswers.intent ?? base.intent;
  const architectureChoices = getArchitectureChoicesForIntent(selectedIntent);
  const setupDetailsAnswers = await prompts(
    [
      {
        type: architectureChoices.length > 1 ? "select" : null,
        name: "architecture",
        message: "Architecture style",
        choices: architectureChoices,
        initial: getInitialChoiceIndex(architectureChoices, base.architecture),
      },
      {
        type: "select",
        name: "templateTier",
        message: "Template tier",
        choices: TEMPLATE_TIER_CHOICES,
        initial: getInitialChoiceIndex(TEMPLATE_TIER_CHOICES, base.templateTier),
      },
      {
        type: "text",
        name: "description",
        message: "Project description",
        initial: base.metadata.description,
      },
      {
        type: "select",
        name: "license",
        message: "License",
        choices: LICENSE_CHOICES,
        initial: getInitialChoiceIndex(LICENSE_CHOICES, base.metadata.license),
      },
    ],
    { onCancel: cancelHandler },
  );

  const projectName = slugifyProjectName(setupAnswers.projectName) || base.projectName;
  const targetDir = resolve(setupAnswers.targetDir || base.targetDir);
  const plan: ProjectPlan = {
    ...base,
    projectName,
    targetDir,
    nodeStrategy: setupAnswers.nodeStrategy ?? base.nodeStrategy,
    customNodeVersion: setupAnswers.customNodeVersion ?? base.customNodeVersion,
    packageManager: setupAnswers.packageManager ?? base.packageManager,
    intent: selectedIntent,
    architecture:
      setupDetailsAnswers.architecture ?? architectureChoices[0]?.value ?? base.architecture,
    templateTier: setupDetailsAnswers.templateTier ?? base.templateTier,
    metadata: {
      ...base.metadata,
      description: setupDetailsAnswers.description || base.metadata.description,
      license: setupDetailsAnswers.license ?? base.metadata.license,
    },
  };
  applyIntentDefaults(plan);

  if (needsFrontend(plan.intent)) {
    const availableFrontendFrameworkChoices =
      plan.architecture === "microfrontend"
        ? FRONTEND_FRAMEWORK_CHOICES.filter((choice) => choice.value === "react-vite")
        : FRONTEND_FRAMEWORK_CHOICES;
    const availableRenderingChoices =
      plan.architecture === "microfrontend"
        ? FRONTEND_RENDERING_CHOICES.filter((choice) => choice.value === "client")
        : FRONTEND_RENDERING_CHOICES;

    const frontendAnswers = await prompts(
      [
        {
          type: "select",
          name: "framework",
          message: "Frontend framework",
          choices: availableFrontendFrameworkChoices,
          initial: getInitialChoiceIndex(availableFrontendFrameworkChoices, plan.frontend?.framework),
        },
        {
          type: "select",
          name: "rendering",
          message: "Rendering mode",
          choices: availableRenderingChoices,
          initial: getInitialChoiceIndex(availableRenderingChoices, plan.frontend?.rendering),
        },
        {
          type: "select",
          name: "styling",
          message: "Styling",
          choices: STYLING_CHOICES,
          initial: getInitialChoiceIndex(STYLING_CHOICES, plan.frontend?.styling),
        },
        {
          type: "select",
          name: "uiLibrary",
          message: "UI library",
          choices: UI_LIBRARY_CHOICES,
          initial: getInitialChoiceIndex(UI_LIBRARY_CHOICES, plan.frontend?.uiLibrary),
        },
        {
          type: plan.intent === "landing-page" ? null : "select",
          name: "state",
          message: "State layer",
          choices: STATE_CHOICES,
          initial: getInitialChoiceIndex(STATE_CHOICES, plan.frontend?.state),
        },
        {
          type: plan.intent === "landing-page" ? null : "select",
          name: "dataFetching",
          message: "Data fetching",
          choices: DATA_FETCHING_CHOICES,
          initial: getInitialChoiceIndex(DATA_FETCHING_CHOICES, plan.frontend?.dataFetching),
        },
      ],
      { onCancel: cancelHandler },
    );

    plan.frontend = {
      framework: frontendAnswers.framework ?? plan.frontend?.framework ?? "react-vite",
      rendering: frontendAnswers.rendering ?? plan.frontend?.rendering ?? "client",
      styling: frontendAnswers.styling ?? plan.frontend?.styling ?? "tailwind-css",
      uiLibrary: frontendAnswers.uiLibrary ?? plan.frontend?.uiLibrary ?? "none",
      state: frontendAnswers.state ?? plan.frontend?.state ?? "none",
      dataFetching:
        frontendAnswers.dataFetching ??
        plan.frontend?.dataFetching ??
        "native-fetch",
    };
  } else {
    delete plan.frontend;
  }

  if (needsBackend(plan.intent)) {
    const languageChoices = [
      { title: "TypeScript", value: "typescript" },
      { title: "JavaScript", value: "javascript" },
    ];
    const adapterChoices = [
      { title: "Fastify", value: "fastify" },
      { title: "Express", value: "express" },
    ];

    const backendAnswers = await prompts(
      [
        {
          type: "select",
          name: "framework",
          message: "Backend framework",
          choices: BACKEND_FRAMEWORK_CHOICES,
          initial: getInitialChoiceIndex(BACKEND_FRAMEWORK_CHOICES, plan.backend?.framework),
        },
        {
          type: "select",
          name: "language",
          message: "Language",
          choices: languageChoices,
          initial: getInitialChoiceIndex(languageChoices, plan.backend?.language),
        },
        {
          type: (_: unknown, values: Record<string, unknown>) =>
            values.framework === "nestjs" ? "select" : null,
          name: "adapter",
          message: "NestJS adapter",
          choices: adapterChoices,
          initial: getInitialChoiceIndex(adapterChoices, plan.backend?.adapter),
        },
        {
          type: "multiselect",
          name: "auth",
          message: "Authentication",
          choices: withSelected(AUTH_CHOICES, plan.backend?.auth ?? []),
        },
        {
          type: "select",
          name: "orm",
          message: "ORM",
          choices: ORM_CHOICES,
          initial: getInitialChoiceIndex(ORM_CHOICES, plan.backend?.orm),
        },
        {
          type: "select",
          name: "database",
          message: "Database",
          choices: DATABASE_CHOICES,
          initial: getInitialChoiceIndex(DATABASE_CHOICES, plan.backend?.database),
        },
        {
          type: "toggle",
          name: "redis",
          message: "Add Redis?",
          initial: plan.backend?.redis ?? false,
          active: "yes",
          inactive: "no",
        },
        {
          type: "toggle",
          name: "swagger",
          message: "Add Swagger docs?",
          initial: plan.backend?.swagger ?? true,
          active: "yes",
          inactive: "no",
        },
        {
          type: "toggle",
          name: "websockets",
          message: "Add WebSockets?",
          initial: plan.backend?.websockets ?? false,
          active: "yes",
          inactive: "no",
        },
      ],
      { onCancel: cancelHandler },
    );

    plan.backend = {
      framework: backendAnswers.framework ?? plan.backend?.framework ?? "hono",
      language: backendAnswers.language ?? plan.backend?.language ?? "typescript",
      adapter: backendAnswers.adapter,
      auth: backendAnswers.auth ?? [],
      orm: backendAnswers.orm ?? "none",
      database: backendAnswers.database ?? "none",
      redis: Boolean(backendAnswers.redis),
      swagger: Boolean(backendAnswers.swagger),
      websockets: Boolean(backendAnswers.websockets),
    };
  } else {
    delete plan.backend;
  }

  if (plan.architecture === "monorepo") {
    const workspaceAnswers = await prompts(
      [
        {
          type: "select",
          name: "tool",
          message: "Monorepo tool",
          choices: WORKSPACE_TOOL_CHOICES,
          initial: getInitialChoiceIndex(WORKSPACE_TOOL_CHOICES, plan.workspace.tool),
        },
      ],
      { onCancel: cancelHandler },
    );

    plan.workspace.tool = workspaceAnswers.tool ?? "turborepo";
  }

  if (plan.intent === "microfrontend-system" || plan.architecture === "microfrontend") {
    const microAnswers = await prompts(
      [
        {
          type: "select",
          name: "microfrontendStrategy",
          message: "Microfrontend strategy",
          choices: MICROFRONTEND_STRATEGY_CHOICES,
          initial: getInitialChoiceIndex(
            MICROFRONTEND_STRATEGY_CHOICES,
            plan.workspace.microfrontendStrategy,
          ),
        },
        {
          type: "text",
          name: "remoteApps",
          message: "Remote apps (comma separated)",
          initial: plan.workspace.remoteApps.join(", "),
        },
      ],
      { onCancel: cancelHandler },
    );

    plan.workspace.microfrontendStrategy =
      microAnswers.microfrontendStrategy ?? "vite-federation";
    plan.workspace.remoteApps = dedupe(
      String(microAnswers.remoteApps ?? "")
        .split(",")
        .map((value) => slugifyProjectName(value) || value.trim())
        .filter(Boolean),
    );
  }

  if (needsChromeExtension(plan.intent)) {
    const extensionAnswers = await prompts(
      [
        {
          type: "select",
          name: "flavor",
          message: "Extension type",
          choices: EXTENSION_FLAVOR_CHOICES,
        },
        {
          type: "toggle",
          name: "includesBackground",
          message: "Include background script?",
          initial: true,
          active: "yes",
          inactive: "no",
        },
        {
          type: "toggle",
          name: "includesContent",
          message: "Include content script?",
          initial: true,
          active: "yes",
          inactive: "no",
        },
        {
          type: "toggle",
          name: "includesPopup",
          message: "Include popup UI?",
          initial: true,
          active: "yes",
          inactive: "no",
        },
      ],
      { onCancel: cancelHandler },
    );

    plan.extension = {
      flavor: extensionAnswers.flavor ?? "react",
      includesBackground: Boolean(extensionAnswers.includesBackground),
      includesContent: Boolean(extensionAnswers.includesContent),
      includesPopup: Boolean(extensionAnswers.includesPopup),
      manifestVersion: "v3",
    };
  }

  const availableTestRunnerChoices = TEST_RUNNER_CHOICES.filter((choice) => {
    if (!plan.frontend && !needsChromeExtension(plan.intent)) {
      return choice.value === "jest" || choice.value === "vitest";
    }

    return true;
  });

  const availableTestEnvironmentChoices = TEST_ENVIRONMENT_CHOICES.filter((choice) => {
    if (!plan.frontend && !needsChromeExtension(plan.intent)) {
      return choice.value === "node";
    }

    return true;
  });

  const testingAnswers = await prompts(
    [
      {
        type: "toggle",
        name: "enabled",
        message: "Add testing setup?",
        initial: plan.testing.enabled,
        active: "yes",
        inactive: "no",
      },
      {
        type: (_: unknown, values: Record<string, unknown>) =>
          values.enabled ? "select" : null,
        name: "runner",
        message: "Test runner",
        choices: availableTestRunnerChoices,
        initial: getInitialChoiceIndex(
          availableTestRunnerChoices,
          plan.testing.runner === "none" ? undefined : plan.testing.runner,
        ),
      },
      {
        type: (_: unknown, values: Record<string, unknown>) =>
          values.enabled &&
          values.runner !== "playwright" &&
          values.runner !== "cypress"
            ? "select"
            : null,
        name: "environment",
        message: "Test environment",
        choices: availableTestEnvironmentChoices,
        initial: getInitialChoiceIndex(
          availableTestEnvironmentChoices,
          plan.testing.environment === "none" || plan.testing.environment === "browser-e2e"
            ? undefined
            : plan.testing.environment,
        ),
      },
      {
        type: (_: unknown, values: Record<string, unknown>) =>
          values.enabled ? "toggle" : null,
        name: "includeExampleTests",
        message: "Generate example test cases?",
        initial: plan.testing.includeExampleTests,
        active: "yes",
        inactive: "no",
      },
    ],
    { onCancel: cancelHandler },
  );

  plan.testing = {
    enabled: Boolean(testingAnswers.enabled),
    runner: testingAnswers.enabled
      ? testingAnswers.runner ?? plan.testing.runner
      : "none",
    environment: testingAnswers.enabled
      ? testingAnswers.runner === "playwright" || testingAnswers.runner === "cypress"
        ? "browser-e2e"
        : testingAnswers.environment ?? plan.testing.environment
      : "none",
    includeExampleTests: Boolean(testingAnswers.includeExampleTests ?? plan.testing.includeExampleTests),
  };

  const availableRuleCategories = getAvailableRuleCategories(plan);
  const selectedRuleCategories = dedupe(
    plan.ai.categories.filter((category) => availableRuleCategories.includes(category)),
  );

  const aiAnswers = await prompts(
    [
      {
        type: "multiselect",
        name: "tools",
        message: "AI tools to configure",
        choices: withSelected(AI_TOOL_CHOICES, plan.ai.tools),
      },
      {
        type: "select",
        name: "ruleMode",
        message: "Rule mode",
        choices: RULE_MODE_CHOICES,
        initial: getInitialChoiceIndex(RULE_MODE_CHOICES, plan.ai.ruleMode),
      },
      {
        type: "multiselect",
        name: "categories",
        message: "Rule categories",
        choices: withSelected(
          RULE_CATEGORY_CHOICES.filter((choice) => availableRuleCategories.includes(choice.value)),
          selectedRuleCategories.length > 0 ? selectedRuleCategories : availableRuleCategories,
        ),
      },
    ],
    { onCancel: cancelHandler },
  );

  plan.ai = {
    tools: aiAnswers.tools ?? plan.ai.tools,
    ruleMode: aiAnswers.ruleMode ?? plan.ai.ruleMode,
    categories: aiAnswers.categories ?? plan.ai.categories,
  };

  const toolingAnswers = await prompts(
    [
      {
        type: "multiselect",
        name: "tooling",
        message: "DevOps and tooling",
        choices: withSelected(
          [
            { title: "ESLint", value: "eslint" },
            { title: "Prettier", value: "prettier" },
            { title: "Husky", value: "husky" },
            { title: "Commitlint", value: "commitlint" },
            { title: "Docker", value: "docker" },
            { title: "GitHub Actions", value: "githubActions" },
          ],
          [
            ...(plan.tooling.eslint ? ["eslint"] : []),
            ...(plan.tooling.prettier ? ["prettier"] : []),
            ...(plan.tooling.husky ? ["husky"] : []),
            ...(plan.tooling.commitlint ? ["commitlint"] : []),
            ...(plan.tooling.docker ? ["docker"] : []),
            ...(plan.tooling.githubActions ? ["githubActions"] : []),
          ],
        ),
      },
    ],
    { onCancel: cancelHandler },
  );

  const enabledTooling = new Set(toolingAnswers.tooling ?? []);
  plan.tooling = {
    eslint: enabledTooling.has("eslint"),
    eslintProfile: enabledTooling.has("eslint") ? "moderate" : plan.tooling.eslintProfile,
    prettier: enabledTooling.has("prettier"),
    prettierProfile: enabledTooling.has("prettier") ? "moderate" : plan.tooling.prettierProfile,
    husky: enabledTooling.has("husky"),
    huskyProfile: enabledTooling.has("husky") ? "moderate" : plan.tooling.huskyProfile,
    commitlint: enabledTooling.has("commitlint"),
    docker: enabledTooling.has("docker"),
    githubActions: enabledTooling.has("githubActions"),
  };

  if (plan.tooling.eslint || plan.tooling.prettier || plan.tooling.husky) {
    const policyAnswers = await prompts(
      [
        {
          type: plan.tooling.eslint ? "select" : null,
          name: "eslintProfile",
          message: "ESLint strictness",
          choices: STRICTNESS_CHOICES,
          initial: getInitialChoiceIndex(STRICTNESS_CHOICES, plan.tooling.eslintProfile),
        },
        {
          type: plan.tooling.prettier ? "select" : null,
          name: "prettierProfile",
          message: "Prettier strictness",
          choices: STRICTNESS_CHOICES,
          initial: getInitialChoiceIndex(STRICTNESS_CHOICES, plan.tooling.prettierProfile),
        },
        {
          type: plan.tooling.husky ? "select" : null,
          name: "huskyProfile",
          message: "Husky strictness",
          choices: STRICTNESS_CHOICES,
          initial: getInitialChoiceIndex(STRICTNESS_CHOICES, plan.tooling.huskyProfile),
        },
      ],
      { onCancel: cancelHandler },
    );

    plan.tooling = {
      ...plan.tooling,
      eslintProfile: policyAnswers.eslintProfile ?? plan.tooling.eslintProfile,
      prettierProfile: policyAnswers.prettierProfile ?? plan.tooling.prettierProfile,
      huskyProfile: policyAnswers.huskyProfile ?? plan.tooling.huskyProfile,
    };
  }

  const gitAnswers = await prompts(
    [
      {
        type: "toggle",
        name: "initialize",
        message: "Initialize git repository?",
        initial: plan.git.initialize,
        active: "yes",
        inactive: "no",
      },
      {
        type: (_: unknown, values: Record<string, unknown>) =>
          values.initialize ? "toggle" : null,
        name: "setupSsh",
        message: "Prepare SSH setup guidance?",
        initial: false,
        active: "yes",
        inactive: "no",
      },
      {
        type: (_: unknown, values: Record<string, unknown>) =>
          values.initialize ? "toggle" : null,
        name: "addRemote",
        message: "Add a remote URL?",
        initial: false,
        active: "yes",
        inactive: "no",
      },
      {
        type: (_: unknown, values: Record<string, unknown>) =>
          values.addRemote ? "text" : null,
        name: "remoteUrl",
        message: "Remote URL",
        initial: plan.git.remoteUrl,
      },
    ],
    { onCancel: cancelHandler },
  );

  plan.git = {
    initialize: Boolean(gitAnswers.initialize),
    setupSsh: Boolean(gitAnswers.setupSsh),
    addRemote: Boolean(gitAnswers.addRemote),
    remoteUrl: gitAnswers.remoteUrl,
  };

  return plan;
}
