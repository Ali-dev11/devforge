import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { BACKEND_FRAMEWORK_CHOICES, PROJECT_INTENT_CHOICES } from "./constants.js";
import { normalizeProjectPlan } from "./engines/decision.js";
import { detectEnvironment } from "./engines/environment.js";
import { generateProject } from "./engines/generator.js";
import { applyIntentDefaults, buildDefaultPlan } from "./engines/prompts.js";
import {
  isNodeVersionSupportedForPlan,
  minimumSupportedNodeVersionHint,
} from "./utils/node-compat.js";
import type {
  BackendFramework,
  ChromeExtensionFlavor,
  CliOptions,
  EnvironmentInfo,
  FrontendFramework,
  ProjectIntent,
  ProjectPlan,
} from "./types.js";

type ScenarioVerificationMode = "http" | "json" | "artifacts";

type RuntimeScenario = {
  name: string;
  description: string;
  intent: ProjectIntent;
  frontendFramework?: FrontendFramework;
  backendFramework?: BackendFramework;
  extensionFlavor?: ChromeExtensionFlavor;
  mode: ScenarioVerificationMode;
  configure: (plan: ProjectPlan) => void;
  runVerification: (context: ScenarioExecutionContext) => Promise<void>;
};

type ScenarioExecutionContext = {
  scenario: RuntimeScenario;
  plan: ProjectPlan;
  targetDir: string;
  port: number;
};

type ScenarioResult = {
  name: string;
  intent: ProjectIntent;
  targetDir: string;
  filesWritten: number;
  skipped?: boolean;
};

type ParsedArgs = {
  keepFixtures: boolean;
  listOnly: boolean;
  scenarioNames: string[];
};

type StartedProcess = {
  child: ChildProcess;
  logs: string[];
  cwd: string;
  command: string;
};

const BASE_PORT = 4600;
const PROCESS_LOG_LIMIT = 80;

function baseCliOptions(): CliOptions {
  return {
    command: "init",
    resume: false,
    skipInstall: true,
    yes: true,
    outputDir: "/tmp/devforge-runtime-matrix",
    projectName: "devforge-runtime-matrix",
  };
}

function makeRuntimePlan(
  environment: EnvironmentInfo,
  scenario: RuntimeScenario,
  targetDir: string,
): ProjectPlan {
  const plan = buildDefaultPlan(environment, baseCliOptions());
  plan.projectName = scenario.name;
  plan.targetDir = targetDir;
  plan.intent = scenario.intent;
  plan.packageManager = "npm";
  plan.templateTier = "production";
  plan.metadata.description = `${scenario.description} Generated for DevForge runtime verification.`;
  plan.tooling = {
    eslint: false,
    eslintProfile: "moderate",
    prettier: false,
    prettierProfile: "moderate",
    husky: false,
    huskyProfile: "moderate",
    commitlint: false,
    docker: false,
    githubActions: false,
  };
  plan.testing = {
    enabled: false,
    runner: "none",
    environment: "none",
    includeExampleTests: false,
  };
  plan.git = {
    initialize: false,
    setupSsh: false,
    addRemote: false,
  };
  plan.ai.tools = ["codex"];
  plan.ai.categories = ["core", "security", "testing"];

  applyIntentDefaults(plan);
  scenario.configure(plan);

  const { plan: normalizedPlan, warnings } = normalizeProjectPlan(plan, environment);
  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.log(`[${scenario.name}] warning: ${warning}`);
    }
  }

  return normalizedPlan;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    keepFixtures: false,
    listOnly: false,
    scenarioNames: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--keep-fixtures") {
      parsed.keepFixtures = true;
      continue;
    }

    if (argument === "--list") {
      parsed.listOnly = true;
      continue;
    }

    if (argument === "--scenario") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --scenario");
      }
      parsed.scenarioNames.push(value);
      index += 1;
      continue;
    }

    if (argument.startsWith("--scenario=")) {
      parsed.scenarioNames.push(argument.slice("--scenario=".length));
      continue;
    }
  }

  return parsed;
}

function lastLogs(logs: string[]): string {
  return logs.slice(-PROCESS_LOG_LIMIT).join("");
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string | undefined> = {},
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...env,
      },
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Command failed in ${cwd}: ${command} ${args.join(" ")} (code: ${code ?? "null"}, signal: ${signal ?? "none"})`,
        ),
      );
    });
  });
}

function startProcess(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string | undefined> = {},
): StartedProcess {
  const child = spawn(command, args, {
    cwd,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const logs: string[] = [];
  const pushChunk = (chunk: string): void => {
    logs.push(chunk);
    if (logs.length > PROCESS_LOG_LIMIT) {
      logs.shift();
    }
  };

  child.stdout?.on("data", (chunk: Buffer | string) => {
    pushChunk(String(chunk));
  });
  child.stderr?.on("data", (chunk: Buffer | string) => {
    pushChunk(String(chunk));
  });

  return {
    child,
    logs,
    cwd,
    command: `${command} ${args.join(" ")}`,
  };
}

function killStartedProcess(processRef: StartedProcess, signal: NodeJS.Signals): void {
  const pid = processRef.child.pid;
  if (!pid) {
    return;
  }

  if (process.platform !== "win32") {
    try {
      process.kill(-pid, signal);
      return;
    } catch {
      // Fall back to killing the direct child if the process group is already gone.
    }
  }

  try {
    processRef.child.kill(signal);
  } catch {
    // Ignore kill errors when the process is already exiting.
  }
}

async function waitForProcessExit(processRef: StartedProcess, timeoutMs: number): Promise<boolean> {
  if (processRef.child.exitCode !== null || processRef.child.killed) {
    return true;
  }

  return new Promise<boolean>((resolve) => {
    const onExit = (): void => {
      clearTimeout(timer);
      resolve(true);
    };

    const timer = setTimeout(() => {
      processRef.child.off("exit", onExit);
      resolve(false);
    }, timeoutMs);

    processRef.child.once("exit", onExit);
  });
}

async function stopProcess(processRef: StartedProcess): Promise<void> {
  if (processRef.child.exitCode !== null || processRef.child.killed) {
    return;
  }

  killStartedProcess(processRef, "SIGTERM");

  const exitedAfterTerminate = await waitForProcessExit(processRef, 5_000);
  if (exitedAfterTerminate) {
    return;
  }

  killStartedProcess(processRef, "SIGKILL");
  await waitForProcessExit(processRef, 5_000);
}

async function waitForHttpText(
  url: string,
  expectations: string[] = [],
  timeoutMs = 30_000,
): Promise<string> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      const body = await response.text();

      if (response.ok && expectations.every((expectation) => body.includes(expectation))) {
        return body;
      }

      lastError =
        response.ok
          ? new Error(`Unexpected HTTP response body from ${url}`)
          : new Error(`Unexpected HTTP response from ${url}: ${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }

    await delay(1_000);
  }

  throw new Error(
    `Timed out waiting for ${url}. Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

async function waitForHttpJson<T extends Record<string, unknown>>(
  url: string,
  predicate: (payload: T) => boolean,
  timeoutMs = 30_000,
): Promise<T> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      const payload = (await response.json()) as T;

      if (response.ok && predicate(payload)) {
        return payload;
      }

      lastError = new Error(`Unexpected JSON payload from ${url}`);
    } catch (error) {
      lastError = error;
    }

    await delay(1_000);
  }

  throw new Error(
    `Timed out waiting for ${url}. Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

async function verifyHttpRuntime(
  context: ScenarioExecutionContext,
  command: {
    cwd?: string;
    command: string;
    args: string[];
    env?: Record<string, string | undefined>;
    path?: string;
  },
  expectations: string[] = [],
): Promise<void> {
  const cwd = command.cwd ? join(context.targetDir, command.cwd) : context.targetDir;
  const started = startProcess(command.command, command.args, cwd, {
    HOST: "127.0.0.1",
    PORT: String(context.port),
    ...command.env,
  });

  try {
    await waitForHttpText(
      `http://127.0.0.1:${context.port}${command.path ?? "/"}`,
      expectations,
    );
  } catch (error) {
    throw new Error(
      [
        error instanceof Error ? error.message : String(error),
        `Last process logs for ${started.command}:`,
        lastLogs(started.logs) || "(no process output captured)",
      ].join("\n"),
    );
  } finally {
    await stopProcess(started);
  }
}

async function verifyPreviewRuntime(
  context: ScenarioExecutionContext,
  previewCommand: { cwd?: string; args: string[]; env?: Record<string, string | undefined> },
  expectations: string[] = [],
): Promise<void> {
  await verifyHttpRuntime(
    context,
    {
      cwd: previewCommand.cwd,
      command: "npm",
      args: ["run", ...previewCommand.args],
      env: previewCommand.env,
    },
    expectations,
  );
}

async function verifyApiRuntime(
  context: ScenarioExecutionContext,
  command: { cwd?: string; script: string; path: string },
): Promise<void> {
  const cwd = command.cwd ? join(context.targetDir, command.cwd) : context.targetDir;
  const started = startProcess("npm", ["run", command.script], cwd, {
    PORT: String(context.port),
  });

  try {
    await waitForHttpJson<Record<string, unknown>>(
      `http://127.0.0.1:${context.port}${command.path}`,
      (payload) => {
        const project =
          payload.project && typeof payload.project === "object"
            ? (payload.project as Record<string, unknown>)
            : undefined;

        return (
          payload.ok === true &&
          payload.generatedBy !== undefined &&
          String(project?.name ?? "").length > 0
        );
      },
    );
  } catch (error) {
    throw new Error(
      [
        error instanceof Error ? error.message : String(error),
        `Last process logs for ${started.command}:`,
        lastLogs(started.logs) || "(no process output captured)",
      ].join("\n"),
    );
  } finally {
    await stopProcess(started);
  }
}

async function verifyCliJson(context: ScenarioExecutionContext): Promise<void> {
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn("node", ["dist/src/index.js", "--json"], {
      cwd: context.targetDir,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr || `CLI scenario exited with code ${code ?? "null"}`));
    });
  });

  const payload = JSON.parse(output) as Record<string, unknown>;
  if (payload.generatedBy === undefined || payload.project === undefined) {
    throw new Error("Generated CLI JSON output is missing project metadata.");
  }
}

async function verifyExtensionArtifacts(context: ScenarioExecutionContext): Promise<void> {
  const manifest = JSON.parse(
    await readFile(join(context.targetDir, "public", "manifest.json"), "utf8"),
  ) as Record<string, unknown>;

  if (manifest.manifest_version !== 3) {
    throw new Error("Chrome extension scaffold did not generate a Manifest V3 definition.");
  }

  const builtManifest = JSON.parse(
    await readFile(join(context.targetDir, "dist", "manifest.json"), "utf8"),
  ) as Record<string, unknown>;

  if (builtManifest.manifest_version !== 3) {
    throw new Error("Built Chrome extension manifest is missing from dist output.");
  }

  await readFile(join(context.targetDir, "dist", "popup.html"), "utf8");
}

export const runtimeScenarios: RuntimeScenario[] = [
  {
    name: "landing-react-vite",
    description: "Landing page runtime on React and Vite",
    intent: "landing-page",
    frontendFramework: "react-vite",
    mode: "http",
    configure(plan) {
      plan.frontend = {
        framework: "react-vite",
        rendering: "static",
        styling: "vanilla-css",
        uiLibrary: "none",
        state: "none",
        dataFetching: "native-fetch",
      };
    },
    runVerification(context) {
      return verifyPreviewRuntime(
        context,
        {
          args: ["preview", "--", "--host", "127.0.0.1", "--port", String(context.port)],
        },
        [],
      );
    },
  },
  {
    name: "frontend-nextjs",
    description: "Frontend app runtime on Next.js",
    intent: "frontend-app",
    frontendFramework: "nextjs",
    mode: "http",
    configure(plan) {
      plan.frontend = {
        framework: "nextjs",
        rendering: "ssr",
        styling: "vanilla-css",
        uiLibrary: "none",
        state: "none",
        dataFetching: "native-fetch",
      };
    },
    runVerification(context) {
      return verifyPreviewRuntime(
        context,
        {
          args: ["start", "--", "--hostname", "127.0.0.1", "--port", String(context.port)],
        },
        [],
      );
    },
  },
  {
    name: "frontend-astro",
    description: "Frontend app runtime on Astro",
    intent: "frontend-app",
    frontendFramework: "astro",
    mode: "http",
    configure(plan) {
      plan.frontend = {
        framework: "astro",
        rendering: "static",
        styling: "vanilla-css",
        uiLibrary: "none",
        state: "none",
        dataFetching: "native-fetch",
      };
    },
    runVerification(context) {
      return verifyPreviewRuntime(
        context,
        {
          args: ["preview", "--", "--host", "127.0.0.1", "--port", String(context.port)],
        },
        [],
      );
    },
  },
  {
    name: "frontend-vue-vite",
    description: "Frontend app runtime on Vue and Vite",
    intent: "frontend-app",
    frontendFramework: "vue-vite",
    mode: "http",
    configure(plan) {
      plan.frontend = {
        framework: "vue-vite",
        rendering: "client",
        styling: "vanilla-css",
        uiLibrary: "none",
        state: "none",
        dataFetching: "native-fetch",
      };
    },
    runVerification(context) {
      return verifyPreviewRuntime(
        context,
        {
          args: ["preview", "--", "--host", "127.0.0.1", "--port", String(context.port)],
        },
        [],
      );
    },
  },
  {
    name: "frontend-nuxt",
    description: "Frontend app runtime on Nuxt",
    intent: "frontend-app",
    frontendFramework: "nuxt",
    mode: "http",
    configure(plan) {
      plan.frontend = {
        framework: "nuxt",
        rendering: "ssr",
        styling: "vanilla-css",
        uiLibrary: "none",
        state: "none",
        dataFetching: "native-fetch",
      };
    },
    runVerification(context) {
      return verifyHttpRuntime(
        context,
        {
          command: "node",
          args: [".output/server/index.mjs"],
          env: {
            HOST: "127.0.0.1",
            PORT: String(context.port),
            NITRO_HOST: "127.0.0.1",
            NITRO_PORT: String(context.port),
          },
        },
        [],
      );
    },
  },
  {
    name: "frontend-svelte",
    description: "Frontend app runtime on Svelte",
    intent: "frontend-app",
    frontendFramework: "svelte",
    mode: "http",
    configure(plan) {
      plan.frontend = {
        framework: "svelte",
        rendering: "client",
        styling: "vanilla-css",
        uiLibrary: "none",
        state: "none",
        dataFetching: "native-fetch",
      };
    },
    runVerification(context) {
      return verifyPreviewRuntime(
        context,
        {
          args: ["preview", "--", "--host", "127.0.0.1", "--port", String(context.port)],
        },
        [],
      );
    },
  },
  {
    name: "frontend-solidjs",
    description: "Frontend app runtime on SolidJS",
    intent: "frontend-app",
    frontendFramework: "solidjs",
    mode: "http",
    configure(plan) {
      plan.frontend = {
        framework: "solidjs",
        rendering: "client",
        styling: "vanilla-css",
        uiLibrary: "none",
        state: "none",
        dataFetching: "native-fetch",
      };
    },
    runVerification(context) {
      return verifyPreviewRuntime(
        context,
        {
          args: ["preview", "--", "--host", "127.0.0.1", "--port", String(context.port)],
        },
        [],
      );
    },
  },
  {
    name: "backend-express",
    description: "Backend API runtime on Express",
    intent: "backend-api",
    backendFramework: "express",
    mode: "http",
    configure(plan) {
      plan.backend = {
        framework: "express",
        language: "typescript",
        auth: [],
        orm: "none",
        database: "none",
        redis: false,
        swagger: false,
        websockets: false,
      };
    },
    runVerification(context) {
      return verifyApiRuntime(context, {
        script: "start",
        path: "/health",
      });
    },
  },
  {
    name: "backend-fastify",
    description: "Backend API runtime on Fastify",
    intent: "backend-api",
    backendFramework: "fastify",
    mode: "http",
    configure(plan) {
      plan.backend = {
        framework: "fastify",
        language: "typescript",
        auth: [],
        orm: "none",
        database: "none",
        redis: false,
        swagger: false,
        websockets: false,
      };
    },
    runVerification(context) {
      return verifyApiRuntime(context, {
        script: "start",
        path: "/health",
      });
    },
  },
  {
    name: "backend-hono",
    description: "Backend API runtime on Hono",
    intent: "backend-api",
    backendFramework: "hono",
    mode: "http",
    configure(plan) {
      plan.backend = {
        framework: "hono",
        language: "typescript",
        auth: [],
        orm: "none",
        database: "none",
        redis: false,
        swagger: false,
        websockets: false,
      };
    },
    runVerification(context) {
      return verifyApiRuntime(context, {
        script: "start",
        path: "/health",
      });
    },
  },
  {
    name: "backend-koa-javascript",
    description: "Backend API runtime on Koa with JavaScript",
    intent: "backend-api",
    backendFramework: "koa",
    mode: "http",
    configure(plan) {
      plan.backend = {
        framework: "koa",
        language: "javascript",
        auth: [],
        orm: "none",
        database: "none",
        redis: false,
        swagger: false,
        websockets: false,
      };
    },
    runVerification(context) {
      return verifyApiRuntime(context, {
        script: "start",
        path: "/health",
      });
    },
  },
  {
    name: "backend-nestjs",
    description: "Backend API runtime on NestJS",
    intent: "backend-api",
    backendFramework: "nestjs",
    mode: "http",
    configure(plan) {
      plan.backend = {
        framework: "nestjs",
        language: "typescript",
        adapter: "express",
        auth: [],
        orm: "none",
        database: "none",
        redis: false,
        swagger: false,
        websockets: false,
      };
    },
    runVerification(context) {
      return verifyApiRuntime(context, {
        script: "start",
        path: "/health",
      });
    },
  },
  {
    name: "fullstack-nextjs",
    description: "Fullstack runtime on Next.js",
    intent: "fullstack-app",
    frontendFramework: "nextjs",
    backendFramework: "express",
    mode: "http",
    configure(plan) {
      plan.frontend = {
        framework: "nextjs",
        rendering: "ssr",
        styling: "vanilla-css",
        uiLibrary: "none",
        state: "none",
        dataFetching: "native-fetch",
      };
      plan.backend = {
        framework: "express",
        language: "typescript",
        auth: [],
        orm: "none",
        database: "none",
        redis: false,
        swagger: false,
        websockets: false,
      };
    },
    runVerification(context) {
      return verifyApiRuntime(context, {
        script: "start",
        path: "/api/health",
      });
    },
  },
  {
    name: "fullstack-react-api",
    description: "Fullstack runtime on React and Express",
    intent: "fullstack-app",
    frontendFramework: "react-vite",
    backendFramework: "express",
    mode: "http",
    configure(plan) {
      plan.frontend = {
        framework: "react-vite",
        rendering: "client",
        styling: "vanilla-css",
        uiLibrary: "none",
        state: "none",
        dataFetching: "native-fetch",
      };
      plan.backend = {
        framework: "express",
        language: "typescript",
        auth: [],
        orm: "none",
        database: "none",
        redis: false,
        swagger: false,
        websockets: false,
      };
    },
    runVerification(context) {
      return verifyApiRuntime(context, {
        script: "start:api",
        path: "/health",
      });
    },
  },
  {
    name: "microfrontend-workspace",
    description: "Microfrontend workspace runtime on React and Vite",
    intent: "microfrontend-system",
    frontendFramework: "react-vite",
    mode: "http",
    configure(plan) {
      plan.architecture = "microfrontend";
      plan.frontend = {
        framework: "react-vite",
        rendering: "client",
        styling: "vanilla-css",
        uiLibrary: "none",
        state: "none",
        dataFetching: "native-fetch",
      };
      plan.workspace.tool = "turborepo";
      plan.workspace.microfrontendStrategy = "vite-federation";
      plan.workspace.remoteApps = ["catalog", "dashboard"];
    },
    runVerification(context) {
      return verifyPreviewRuntime(
        context,
        {
          cwd: "apps/host",
          args: ["preview", "--", "--host", "127.0.0.1", "--port", String(context.port)],
        },
        [],
      );
    },
  },
  {
    name: "chrome-extension-react",
    description: "Chrome extension artifact verification on React",
    intent: "chrome-extension",
    extensionFlavor: "react",
    mode: "artifacts",
    configure(plan) {
      plan.extension = {
        flavor: "react",
        includesBackground: true,
        includesContent: true,
        includesPopup: true,
        manifestVersion: "v3",
      };
    },
    runVerification(context) {
      return verifyExtensionArtifacts(context);
    },
  },
  {
    name: "chrome-extension-vanilla-ts",
    description: "Chrome extension artifact verification on vanilla TypeScript",
    intent: "chrome-extension",
    extensionFlavor: "vanilla-ts",
    mode: "artifacts",
    configure(plan) {
      plan.extension = {
        flavor: "vanilla-ts",
        includesBackground: true,
        includesContent: true,
        includesPopup: true,
        manifestVersion: "v3",
      };
    },
    runVerification(context) {
      return verifyExtensionArtifacts(context);
    },
  },
  {
    name: "cli-tool",
    description: "CLI tool runtime verification",
    intent: "cli-tool",
    mode: "json",
    configure(plan) {
      plan.metadata.description = "CLI tool generated for runtime verification.";
    },
    runVerification(context) {
      return verifyCliJson(context);
    },
  },
];

export function getRuntimeScenario(name: string): RuntimeScenario | undefined {
  return runtimeScenarios.find((scenario) => scenario.name === name);
}

export function runtimeScenarioCoverage(): {
  intents: ProjectIntent[];
  backendFrameworks: BackendFramework[];
} {
  const intents = Array.from(new Set(runtimeScenarios.map((scenario) => scenario.intent))).sort();
  const backendFrameworks = Array.from(
    new Set(
      runtimeScenarios
        .map((scenario) => scenario.backendFramework)
        .filter((framework): framework is BackendFramework => Boolean(framework)),
    ),
  ).sort();

  return { intents, backendFrameworks };
}

async function runScenario(
  scenario: RuntimeScenario,
  environment: EnvironmentInfo,
  keepFixtures: boolean,
  scenarioIndex: number,
): Promise<ScenarioResult> {
  const fixtureRoot = await mkdtemp(join(tmpdir(), `devforge-runtime-${scenario.name}-`));
  const targetDir = join(fixtureRoot, "project");
  const plan = makeRuntimePlan(environment, scenario, targetDir);

  if (!isNodeVersionSupportedForPlan(plan, environment.nodeVersion)) {
    console.log(
      `[${scenario.name}] skipped on local Node ${environment.nodeVersion}; this scenario needs ${minimumSupportedNodeVersionHint(
        plan,
      )}`,
    );
    if (!keepFixtures) {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
    return {
      name: scenario.name,
      intent: scenario.intent,
      targetDir,
      filesWritten: 0,
      skipped: true,
    };
  }

  const generated = await generateProject(plan, environment);

  try {
    console.log(`[${scenario.name}] installing dependencies`);
    await runCommand("npm", ["install", "--no-audit", "--no-fund"], targetDir);

    console.log(`[${scenario.name}] building scaffold`);
    await runCommand("npm", ["run", "build"], targetDir);

    console.log(`[${scenario.name}] verifying ${scenario.mode}`);
    await scenario.runVerification({
      scenario,
      plan,
      targetDir,
      port: BASE_PORT + scenarioIndex,
    });
  } catch (error) {
    if (!keepFixtures) {
      console.log(`[${scenario.name}] keeping failed fixture at ${targetDir}`);
    }
    throw error;
  }

  if (!keepFixtures) {
    await rm(fixtureRoot, { recursive: true, force: true });
  }

  return {
    name: scenario.name,
    intent: scenario.intent,
    targetDir,
    filesWritten: generated.filesWritten.length,
  };
}

export async function runRuntimeMatrix(argv = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgs(argv);

  if (parsed.listOnly) {
    for (const scenario of runtimeScenarios) {
      console.log(scenario.name);
    }
    return;
  }

  const environment = detectEnvironment();
  const selectedScenarios =
    parsed.scenarioNames.length > 0
      ? parsed.scenarioNames.map((name) => {
          const scenario = getRuntimeScenario(name);
          if (!scenario) {
            throw new Error(`Unknown runtime scenario: ${name}`);
          }
          return scenario;
        })
      : runtimeScenarios;

  const results: ScenarioResult[] = [];

  for (const [index, scenario] of selectedScenarios.entries()) {
    console.log(`\n=== ${scenario.name} ===`);
    const result = await runScenario(scenario, environment, parsed.keepFixtures, index);
    results.push(result);
    console.log(`[${scenario.name}] verified ${result.filesWritten} generated files`);
  }

  console.log("\nRuntime matrix completed.");
  console.log(JSON.stringify(results, null, 2));
}

export function expectedIntentCoverage(): ProjectIntent[] {
  return PROJECT_INTENT_CHOICES.map((choice) => choice.value);
}

export function expectedBackendFrameworkCoverage(): BackendFramework[] {
  return BACKEND_FRAMEWORK_CHOICES.map((choice) => choice.value);
}
