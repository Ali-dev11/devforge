import {
  DEFAULT_REMOTE_APPS,
  DEFAULT_RULE_CATEGORIES,
  REACT_FAMILY_FRAMEWORKS,
  SUPPORTED_MICROFRONTEND_STRATEGIES,
  VUE_FAMILY_FRAMEWORKS,
} from "../constants.js";
import type {
  EnvironmentInfo,
  FrontendFramework,
  NormalizedPlanResult,
  ProjectPlan,
  RuleCategory,
} from "../types.js";
import {
  chooseSupportedPackageManager,
  getSupportedBackendLanguages,
  getDefaultRenderingMode,
  getSupportedDataFetchingChoices,
  getSupportedFrontendFrameworks,
  getSupportedPackageManagers,
  getSupportedRenderingModes,
  getSupportedStateChoices,
  getSupportedTestRunners,
  getSupportedUiLibraries,
} from "../guidance.js";
import {
  isNodeVersionSupportedForPlan,
  minimumSupportedNodeVersionHint,
} from "../utils/node-compat.js";
import { dedupe } from "../utils/strings.js";

function supportsShadcn(framework: FrontendFramework): boolean {
  return REACT_FAMILY_FRAMEWORKS.has(framework);
}

export function getAvailableRuleCategories(plan: ProjectPlan): RuleCategory[] {
  const categories: RuleCategory[] = [...DEFAULT_RULE_CATEGORIES];

  if (plan.frontend || plan.intent === "chrome-extension") {
    categories.push("frontend");
  }

  if (plan.backend) {
    categories.push("backend");
  }

  if (plan.architecture !== "simple") {
    categories.push("architecture");
  }

  return dedupe(categories);
}

export function normalizeProjectPlan(
  inputPlan: ProjectPlan,
  environment: EnvironmentInfo,
): NormalizedPlanResult {
  const plan: ProjectPlan = JSON.parse(JSON.stringify(inputPlan)) as ProjectPlan;
  const warnings: string[] = [];

  if (plan.intent === "microfrontend-system") {
    plan.architecture = "microfrontend";
  }

  if (plan.intent !== "microfrontend-system" && plan.architecture === "microfrontend") {
    warnings.push(
      `Microfrontend architecture is only generated for the dedicated microfrontend-system intent; switching architecture to ${plan.intent === "chrome-extension" ? "modular" : "simple"}.`,
    );
    plan.architecture = plan.intent === "chrome-extension" ? "modular" : "simple";
  }

  if (plan.architecture === "microfrontend" && !plan.workspace.microfrontendStrategy) {
    plan.workspace.microfrontendStrategy = "vite-federation";
  }

  if (
    plan.architecture === "microfrontend" &&
    plan.workspace.microfrontendStrategy &&
    !SUPPORTED_MICROFRONTEND_STRATEGIES.includes(plan.workspace.microfrontendStrategy)
  ) {
    warnings.push(
      `Microfrontend scaffolds currently generate ${SUPPORTED_MICROFRONTEND_STRATEGIES
        .map((strategy) => strategy.replace(/-/g, " "))
        .join(", ")} projects; switching strategy to vite-federation.`,
    );
    plan.workspace.microfrontendStrategy = "vite-federation";
  }

  if (plan.architecture === "monorepo" && !plan.workspace.tool) {
    plan.workspace.tool = "turborepo";
  }

  const supportedPackageManagers = getSupportedPackageManagers(plan.intent, plan.architecture);
  if (!supportedPackageManagers.includes(plan.packageManager)) {
    const nextPackageManager = chooseSupportedPackageManager(plan, environment);
    warnings.push(
      `${plan.packageManager} is not supported for ${plan.intent} projects with a ${plan.architecture} architecture; switching package manager to ${nextPackageManager}.`,
    );
    plan.packageManager = nextPackageManager;
  }

  if (plan.architecture === "microfrontend" && plan.workspace.remoteApps.length === 0) {
    plan.workspace.remoteApps = DEFAULT_REMOTE_APPS;
  }

  if (["backend-api", "cli-tool", "chrome-extension"].includes(plan.intent)) {
    delete plan.frontend;
  }

  if (["landing-page", "frontend-app", "chrome-extension", "cli-tool"].includes(plan.intent)) {
    delete plan.backend;
  }

  if (plan.intent === "landing-page" && plan.frontend) {
    plan.frontend.state = "none";
    plan.frontend.dataFetching = "native-fetch";
  }

  if (plan.intent === "chrome-extension") {
    plan.architecture = "modular";
    plan.extension ??= {
      flavor: "react",
      includesBackground: true,
      includesContent: true,
      includesPopup: true,
      manifestVersion: "v3",
    };
  } else {
    delete plan.extension;
  }

  if (plan.architecture === "microfrontend" && plan.frontend) {
    if (plan.frontend.framework !== "react-vite") {
      warnings.push(
        `Microfrontend scaffolds are currently generated for React (Vite); switching ${plan.frontend.framework} to react-vite.`,
      );
      plan.frontend.framework = "react-vite";
    }

    if (plan.frontend.rendering !== "client") {
      warnings.push("Microfrontend scaffolds are generated as client-rendered apps; switching rendering mode to client.");
      plan.frontend.rendering = "client";
    }
  }

  if (plan.frontend) {
    const supportedFrameworks = getSupportedFrontendFrameworks(
      plan.packageManager,
      plan.architecture,
    );

    if (!supportedFrameworks.includes(plan.frontend.framework)) {
      const compatiblePackageManager = getSupportedPackageManagers(plan.intent, plan.architecture).find(
        (packageManager) =>
          getSupportedFrontendFrameworks(packageManager, plan.architecture).includes(
            plan.frontend?.framework ?? "react-vite",
          ),
      );

      if (compatiblePackageManager) {
        warnings.push(
          `${plan.packageManager} is not currently verified for ${plan.frontend.framework}; switching package manager to ${compatiblePackageManager}.`,
        );
        plan.packageManager = compatiblePackageManager;
      } else {
        const fallbackFramework = supportedFrameworks[0] ?? "react-vite";
        warnings.push(
          `${plan.frontend.framework} is not supported with ${plan.packageManager}; switching frontend framework to ${fallbackFramework}.`,
        );
        plan.frontend.framework = fallbackFramework;
      }
    }

    const supportedRenderingModes = getSupportedRenderingModes(
      plan.frontend.framework,
      plan.architecture,
    );
    if (!supportedRenderingModes.includes(plan.frontend.rendering)) {
      const fallbackRendering = getDefaultRenderingMode(
        plan.frontend.framework,
        plan.intent,
        plan.architecture,
      );
      warnings.push(
        `${plan.frontend.framework} does not support ${plan.frontend.rendering} rendering in generated projects; switching rendering mode to ${fallbackRendering}.`,
      );
      plan.frontend.rendering = fallbackRendering;
    }

    const supportedUiLibraries = getSupportedUiLibraries(plan.frontend.framework);
    if (!supportedUiLibraries.includes(plan.frontend.uiLibrary)) {
      const fallbackUiLibrary = supportedUiLibraries[0] ?? "none";
      warnings.push(
        `${plan.frontend.uiLibrary} is not scaffolded for ${plan.frontend.framework}; switching UI library to ${fallbackUiLibrary}.`,
      );
      plan.frontend.uiLibrary = fallbackUiLibrary;
    }

    const supportedStateChoices = getSupportedStateChoices(plan.frontend.framework, plan.intent);
    if (!supportedStateChoices.includes(plan.frontend.state)) {
      const fallbackState = supportedStateChoices[0] ?? "none";
      warnings.push(
        `${plan.frontend.state} is not scaffolded for ${plan.frontend.framework}; switching state management to ${fallbackState}.`,
      );
      plan.frontend.state = fallbackState;
    }

    const supportedDataChoices = getSupportedDataFetchingChoices(
      plan.frontend.framework,
      plan.intent,
    );
    if (!supportedDataChoices.includes(plan.frontend.dataFetching)) {
      const fallbackData = supportedDataChoices[0] ?? "native-fetch";
      warnings.push(
        `${plan.frontend.dataFetching} is not scaffolded for ${plan.frontend.framework}; switching data fetching to ${fallbackData}.`,
      );
      plan.frontend.dataFetching = fallbackData;
    }
  }

  if (plan.frontend?.uiLibrary === "shadcn-ui" && !supportsShadcn(plan.frontend.framework)) {
    warnings.push(
      `shadcn/ui is not a strong default for ${plan.frontend.framework}; falling back to no UI library.`,
    );
    plan.frontend.uiLibrary = "none";
  }

  if (
    plan.frontend &&
    (VUE_FAMILY_FRAMEWORKS.has(plan.frontend.framework) ||
      plan.frontend.framework === "angular" ||
      plan.frontend.framework === "svelte" ||
      plan.frontend.framework === "sveltekit" ||
      plan.frontend.framework === "solidjs" ||
      plan.frontend.framework === "astro")
  ) {
    if (plan.frontend.state === "zustand") {
      warnings.push(
        `${plan.frontend.framework} does not map cleanly to Zustand by default; using no state layer instead.`,
      );
      plan.frontend.state = "none";
    }

    if (plan.frontend.state === "redux" || plan.frontend.state === "redux-toolkit") {
      warnings.push(
        `${plan.frontend.framework} scaffold support does not wire Redux by default; using no state layer instead.`,
      );
      plan.frontend.state = "none";
    }

    if (plan.frontend.dataFetching === "swr") {
      warnings.push(
        `SWR is React-focused; switching ${plan.frontend.framework} to native fetch.`,
      );
      plan.frontend.dataFetching = "native-fetch";
    }
  }

  if (plan.frontend?.dataFetching === "rtk-query") {
    if (!REACT_FAMILY_FRAMEWORKS.has(plan.frontend.framework)) {
      warnings.push(
        `RTK Query scaffold support is React-oriented; switching ${plan.frontend.framework} to native fetch.`,
      );
      plan.frontend.dataFetching = "native-fetch";
    } else if (plan.frontend.state !== "redux-toolkit" && plan.frontend.state !== "redux") {
      warnings.push("RTK Query works best with Redux Toolkit; switching state management to Redux Toolkit.");
      plan.frontend.state = "redux-toolkit";
    }
  }

  if (plan.backend) {
    const supportedBackendLanguages = getSupportedBackendLanguages(plan.backend.framework);
    if (!supportedBackendLanguages.includes(plan.backend.language)) {
      warnings.push(
        `${plan.backend.framework} is generated as a ${supportedBackendLanguages.join("/")} stack; switching backend language to ${supportedBackendLanguages[0]}.`,
      );
      plan.backend.language = supportedBackendLanguages[0] ?? "typescript";
    }

    if (plan.backend.framework !== "nestjs") {
      delete plan.backend.adapter;
    }

    if (plan.backend.orm !== "none" && plan.backend.database === "none") {
      warnings.push("ORM selected without a database; defaulting to PostgreSQL.");
      plan.backend.database = "postgresql";
    }

    if (plan.backend.orm === "drizzle" && plan.backend.database === "mongodb") {
      warnings.push("Drizzle ORM does not support MongoDB in generated backends; switching ORM to none and keeping MongoDB.");
      plan.backend.orm = "none";
    }
  }

  if (plan.ai.tools.length === 0) {
    warnings.push("No AI tools selected; generating AGENTS.md for Codex by default.");
    plan.ai.tools = ["codex"];
  }

  if (
    plan.nodeStrategy === "custom" &&
    plan.customNodeVersion &&
    !isNodeVersionSupportedForPlan(plan, plan.customNodeVersion)
  ) {
    warnings.push(
      `Selected Node.js ${plan.customNodeVersion} is below the recommended minimum for this stack (${minimumSupportedNodeVersionHint(
        plan,
      )}). Upgrade Node or choose LTS/latest to avoid install and build failures.`,
    );
  }

  if (!plan.testing.enabled) {
    plan.testing.runner = "none";
    plan.testing.environment = "none";
  }

  const supportedTestRunners = getSupportedTestRunners(plan);
  if (plan.testing.enabled && !supportedTestRunners.includes(plan.testing.runner)) {
    const fallbackRunner = hasFrontendLikeSurface(plan)
      ? (supportedTestRunners.find(
          (runner) => runner === "vitest" || runner === "playwright" || runner === "jest",
        ) ?? supportedTestRunners[0] ?? "vitest")
      : (supportedTestRunners.find((runner) => runner === "jest" || runner === "vitest") ??
        supportedTestRunners[0] ??
        "jest");
    warnings.push(
      `${plan.testing.runner} is not scaffolded for the selected stack; switching test runner to ${fallbackRunner}.`,
    );
    plan.testing.runner = fallbackRunner;
  }

  if (plan.testing.runner === "playwright" || plan.testing.runner === "cypress") {
    if (!plan.frontend && plan.intent !== "chrome-extension") {
      warnings.push("Browser E2E runners need a frontend surface; switching testing to Jest on Node.");
      plan.testing.runner = "jest";
      plan.testing.environment = "node";
    } else {
      plan.testing.environment = "browser-e2e";
    }
  }

  if (
    plan.testing.enabled &&
    !plan.frontend &&
    plan.intent !== "chrome-extension" &&
    (plan.testing.environment === "jsdom" || plan.testing.environment === "happy-dom")
  ) {
    warnings.push("Node-oriented projects should use a Node test environment; switching test environment to node.");
    plan.testing.environment = "node";
  }

  const availableRuleCategories = getAvailableRuleCategories(plan);
  const filteredRuleCategories = dedupe(
    plan.ai.categories.filter((category) => availableRuleCategories.includes(category)),
  );

  if (filteredRuleCategories.length !== plan.ai.categories.length) {
    warnings.push("Removed AI rule categories that do not apply to the selected project stack.");
  }

  plan.ai.categories =
    filteredRuleCategories.length > 0 ? filteredRuleCategories : availableRuleCategories;

  return { plan, warnings };
}

function hasFrontendLikeSurface(plan: ProjectPlan): boolean {
  return Boolean(plan.frontend) || plan.intent === "chrome-extension";
}
