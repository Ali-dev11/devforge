import test from "node:test";
import assert from "node:assert/strict";
import {
  BACKEND_FRAMEWORK_CHOICES,
  STYLING_CHOICES,
  STRICTNESS_CHOICES,
  TEMPLATE_TIER_CHOICES,
} from "../src/constants.js";
import {
  applyIntentDefaultsForChange,
  buildDefaultPlan,
  getArchitectureChoicesForIntent,
} from "../src/engines/prompts.js";
import { normalizeProjectPlan } from "../src/engines/decision.js";
import {
  getSupportedBackendLanguages,
  getSupportedDataFetchingChoicesForState,
  getSupportedFrontendFrameworks,
  getSupportedPackageManagers,
  getSupportedRenderingModes,
  getSupportedStateChoices,
  getSupportedTestEnvironments,
  getSupportedTestRunners,
  getSupportedUiLibraries,
} from "../src/guidance.js";
import { buildProjectFiles } from "../src/templates.js";
import type {
  ArchitectureMode,
  AuthMode,
  CliOptions,
  DatabaseChoice,
  EnvironmentInfo,
  OrmChoice,
  ProjectIntent,
  ProjectPlan,
  StrictnessLevel,
  TemplateTier,
  WorkspaceTool,
} from "../src/types.js";

const environment: EnvironmentInfo = {
  platform: "darwin",
  arch: "arm64",
  nodeVersion: "v22.12.0",
  recommendedPackageManager: "pnpm",
  packageManagers: {
    npm: { installed: true, version: "10.5.1", path: "/usr/bin/npm" },
    pnpm: { installed: true, version: "9.0.0", path: "/usr/local/bin/pnpm" },
    yarn: { installed: true, version: "4.1.0", path: "/usr/local/bin/yarn" },
    bun: { installed: true, version: "1.2.19", path: "/usr/local/bin/bun" },
  },
  systemTools: {
    git: { installed: true, version: "2.45.1", path: "/usr/bin/git" },
    docker: { installed: true, version: "27.0.0", path: "/usr/local/bin/docker" },
    corepack: { installed: true, version: "0.29.3", path: "/usr/local/bin/corepack" },
  },
};

const cliOptions: CliOptions = {
  command: "init",
  resume: false,
  skipInstall: true,
  yes: true,
  outputDir: "/tmp/devforge-combination-matrix",
  projectName: "devforge-combination-matrix",
};

const AUTH_COMBINATIONS: AuthMode[][] = [
  [],
  ["jwt"],
  ["oauth"],
  ["jwt", "oauth"],
];

const NODE_STRATEGIES: Array<ProjectPlan["nodeStrategy"]> = ["lts", "latest", "custom"];

function createPlan(intent: ProjectIntent, architecture: ArchitectureMode): ProjectPlan {
  const plan = buildDefaultPlan(environment, cliOptions);
  const previousIntent = plan.intent;
  plan.intent = intent;
  applyIntentDefaultsForChange(plan, previousIntent);
  plan.architecture = architecture;
  if (architecture === "monorepo") {
    plan.workspace.tool = "turborepo";
  }
  if (architecture === "microfrontend") {
    plan.workspace.microfrontendStrategy = "vite-federation";
    plan.workspace.remoteApps = ["catalog", "dashboard"];
  }
  return plan;
}

function workspaceToolsForArchitecture(architecture: ArchitectureMode): WorkspaceTool[] {
  return architecture === "monorepo" ? ["turborepo", "nx"] : ["turborepo"];
}

function ormChoicesForDatabase(database: DatabaseChoice): OrmChoice[] {
  if (database === "none") {
    return ["none"];
  }

  return database === "mongodb" ? ["none", "prisma"] : ["none", "prisma", "drizzle"];
}

function assertGeneratedScaffold(plan: ProjectPlan, label: string): void {
  const normalized = normalizeProjectPlan(plan, environment);
  assert.equal(normalized.warnings.length, 0, `${label}: ${normalized.warnings.join(" | ")}`);

  const files = buildProjectFiles(normalized.plan, environment);
  const paths = files.map((file) => file.path);

  assert.equal(new Set(paths).size, paths.length, `${label}: duplicate generated file paths`);
  assert.ok(paths.includes("package.json"), `${label}: missing package.json`);
  assert.ok(paths.includes("docs/getting-started.md"), `${label}: missing docs/getting-started.md`);
  assert.ok(paths.includes("README.md"), `${label}: missing README.md`);
}

test("supported frontend combinations generate clean scaffolds", () => {
  let checked = 0;

  for (const intent of ["landing-page", "frontend-app"] as const) {
    for (const { value: architecture } of getArchitectureChoicesForIntent(intent)) {
      for (const packageManager of getSupportedPackageManagers(intent, architecture)) {
        for (const workspaceTool of workspaceToolsForArchitecture(architecture)) {
          for (const framework of getSupportedFrontendFrameworks(packageManager, architecture)) {
            for (const rendering of getSupportedRenderingModes(framework, architecture)) {
              for (const styling of STYLING_CHOICES.map((choice) => choice.value)) {
                for (const uiLibrary of getSupportedUiLibraries(framework)) {
                  for (const state of getSupportedStateChoices(framework, intent)) {
                    for (const dataFetching of getSupportedDataFetchingChoicesForState(framework, intent, state)) {
                      const plan = createPlan(intent, architecture);
                      plan.packageManager = packageManager;
                      plan.workspace.tool = workspaceTool;
                      plan.testing = {
                        enabled: false,
                        runner: "none",
                        environment: "none",
                        includeExampleTests: false,
                      };
                      plan.frontend = {
                        framework,
                        rendering,
                        styling,
                        uiLibrary,
                        state,
                        dataFetching,
                      };

                      assertGeneratedScaffold(
                        plan,
                        `${intent}/${architecture}/${packageManager}/${framework}/${rendering}/${styling}/${uiLibrary}/${state}/${dataFetching}`,
                      );
                      checked += 1;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  assert.ok(checked > 1000, `expected a large frontend sweep, got ${checked}`);
});

test("supported fullstack and backend combinations generate clean scaffolds", () => {
  let checked = 0;

  for (const intent of ["backend-api", "fullstack-app"] as const) {
    for (const { value: architecture } of getArchitectureChoicesForIntent(intent)) {
      for (const packageManager of getSupportedPackageManagers(intent, architecture)) {
        for (const workspaceTool of workspaceToolsForArchitecture(architecture)) {
          for (const backendFramework of BACKEND_FRAMEWORK_CHOICES.map((choice) => choice.value)) {
            for (const language of getSupportedBackendLanguages(backendFramework)) {
              for (const database of ["none", "postgresql", "mongodb"] as const) {
                for (const orm of ormChoicesForDatabase(database)) {
                  const plan = createPlan(intent, architecture);
                  plan.packageManager = packageManager;
                  plan.workspace.tool = workspaceTool;
                  plan.testing = {
                    enabled: false,
                    runner: "none",
                    environment: "none",
                    includeExampleTests: false,
                  };
                  plan.backend = {
                    framework: backendFramework,
                    language,
                    adapter: backendFramework === "nestjs" ? "fastify" : undefined,
                    auth: [],
                    orm,
                    database,
                    redis: false,
                    swagger: true,
                    websockets: false,
                  };

                  if (intent === "fullstack-app") {
                    plan.frontend = plan.frontend ?? {
                      framework: "react-vite",
                      rendering: "client",
                      styling: "tailwind-css",
                      uiLibrary: "shadcn-ui",
                      state: "zustand",
                      dataFetching: "tanstack-query",
                    };
                  }

                  assertGeneratedScaffold(
                    plan,
                    `${intent}/${architecture}/${packageManager}/${backendFramework}/${language}/${database}/${orm}`,
                  );
                  checked += 1;
                }
              }
            }
          }
        }
      }
    }
  }

  for (const backendFramework of BACKEND_FRAMEWORK_CHOICES.map((choice) => choice.value)) {
    for (const auth of AUTH_COMBINATIONS) {
      for (const redis of [false, true]) {
        for (const swagger of [false, true]) {
          for (const websockets of [false, true]) {
            const plan = createPlan("backend-api", "simple");
            plan.testing = {
              enabled: false,
              runner: "none",
              environment: "none",
              includeExampleTests: false,
            };
            plan.backend = {
              framework: backendFramework,
              language: getSupportedBackendLanguages(backendFramework)[0] ?? "typescript",
              adapter: backendFramework === "nestjs" ? "fastify" : undefined,
              auth,
              orm: "prisma",
              database: "postgresql",
              redis,
              swagger,
              websockets,
            };
            assertGeneratedScaffold(
              plan,
              `backend-capabilities/${backendFramework}/${auth.join("+") || "none"}/${redis}/${swagger}/${websockets}`,
            );
            checked += 1;
          }
        }
      }
    }
  }

  assert.ok(checked > 1000, `expected a large backend sweep, got ${checked}`);
});

test("supported microfrontend, extension, and cli combinations generate clean scaffolds", () => {
  let checked = 0;

  for (const packageManager of getSupportedPackageManagers("microfrontend-system", "microfrontend")) {
    const plan = createPlan("microfrontend-system", "microfrontend");
    plan.packageManager = packageManager;

    for (const styling of STYLING_CHOICES.map((choice) => choice.value)) {
      for (const uiLibrary of getSupportedUiLibraries("react-vite")) {
        for (const state of getSupportedStateChoices("react-vite", "microfrontend-system")) {
          for (const dataFetching of getSupportedDataFetchingChoicesForState("react-vite", "microfrontend-system", state)) {
            const comboPlan = structuredClone(plan);
            comboPlan.testing = {
              enabled: false,
              runner: "none",
              environment: "none",
              includeExampleTests: false,
            };
            comboPlan.frontend = {
              framework: "react-vite",
              rendering: "client",
              styling,
              uiLibrary,
              state,
              dataFetching,
            };
            comboPlan.workspace.remoteApps = ["catalog", "dashboard", "search"];
            assertGeneratedScaffold(
              comboPlan,
              `microfrontend/${packageManager}/${styling}/${uiLibrary}/${state}/${dataFetching}`,
            );
            checked += 1;
          }
        }
      }
    }
  }

  for (const flavor of ["react", "vanilla-ts"] as const) {
    for (const includesBackground of [false, true]) {
      for (const includesContent of [false, true]) {
        for (const includesPopup of [false, true]) {
          const plan = createPlan("chrome-extension", "modular");
          plan.extension = {
            flavor,
            includesBackground,
            includesContent,
            includesPopup,
            manifestVersion: "v3",
          };

          assertGeneratedScaffold(
            plan,
            `extension/${flavor}/${includesBackground}/${includesContent}/${includesPopup}`,
          );
          checked += 1;
        }
      }
    }
  }

  for (const architecture of getArchitectureChoicesForIntent("cli-tool").map((choice) => choice.value)) {
    for (const packageManager of getSupportedPackageManagers("cli-tool", architecture)) {
      for (const workspaceTool of workspaceToolsForArchitecture(architecture)) {
        const plan = createPlan("cli-tool", architecture);
        plan.packageManager = packageManager;
        plan.workspace.tool = workspaceTool;
        assertGeneratedScaffold(plan, `cli/${architecture}/${packageManager}/${workspaceTool}`);
        checked += 1;
      }
    }
  }

  assert.ok(checked > 100, `expected a large microfrontend/extension/cli sweep, got ${checked}`);
});

test("supported testing, tooling, node, and template combinations remain buildable", () => {
  let checked = 0;

  const representativePlans: ProjectPlan[] = [
    createPlan("frontend-app", "simple"),
    createPlan("fullstack-app", "monorepo"),
  ];

  for (const templateTier of TEMPLATE_TIER_CHOICES.map((choice) => choice.value as TemplateTier)) {
    for (const nodeStrategy of NODE_STRATEGIES) {
      for (const eslint of [false, true]) {
        for (const prettier of [false, true]) {
          for (const husky of [false, true]) {
            for (const commitlint of [false, true]) {
              for (const docker of [false, true]) {
                for (const githubActions of [false, true]) {
                  const eslintProfiles = eslint
                    ? STRICTNESS_CHOICES.map((choice) => choice.value as StrictnessLevel)
                    : ["moderate"];
                  const prettierProfiles = prettier
                    ? STRICTNESS_CHOICES.map((choice) => choice.value as StrictnessLevel)
                    : ["moderate"];
                  const huskyProfiles = husky
                    ? STRICTNESS_CHOICES.map((choice) => choice.value as StrictnessLevel)
                    : ["moderate"];

                  for (const eslintProfile of eslintProfiles) {
                    for (const prettierProfile of prettierProfiles) {
                      for (const huskyProfile of huskyProfiles) {
                        for (const basePlan of representativePlans) {
                          const plan = structuredClone(basePlan);
                          plan.templateTier = templateTier;
                          plan.nodeStrategy = nodeStrategy;
                          plan.customNodeVersion =
                            nodeStrategy === "custom" ? "22.12.0" : undefined;
                          plan.tooling = {
                            eslint,
                            eslintProfile,
                            prettier,
                            prettierProfile,
                            husky,
                            huskyProfile,
                            commitlint,
                            docker,
                            githubActions,
                          };

                          assertGeneratedScaffold(
                            plan,
                            `tooling/${plan.intent}/${templateTier}/${nodeStrategy}/${eslint}/${prettier}/${husky}/${commitlint}/${docker}/${githubActions}/${eslintProfile}/${prettierProfile}/${huskyProfile}`,
                          );
                          checked += 1;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  for (const basePlan of representativePlans) {
    for (const runner of getSupportedTestRunners(basePlan)) {
      const testPlan = structuredClone(basePlan);
      for (const environmentName of getSupportedTestEnvironments(testPlan, runner)) {
        testPlan.testing = {
          enabled: true,
          runner,
          environment: environmentName,
          includeExampleTests: true,
        };
        assertGeneratedScaffold(
          testPlan,
          `testing/${testPlan.intent}/${runner}/${environmentName}`,
        );
        checked += 1;
      }
    }

    const disabledPlan = structuredClone(basePlan);
    disabledPlan.testing = {
      enabled: false,
      runner: "none",
      environment: "none",
      includeExampleTests: false,
    };
    assertGeneratedScaffold(disabledPlan, `testing/${disabledPlan.intent}/disabled`);
    checked += 1;
  }

  assert.ok(checked > 10000, `expected a large tooling/testing sweep, got ${checked}`);
});
