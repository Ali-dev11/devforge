import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateProject } from "../src/engines/generator.js";
import { applyIntentDefaults, buildDefaultPlan } from "../src/engines/prompts.js";
import { buildProjectFiles } from "../src/templates.js";
import { writeGeneratedFiles } from "../src/utils/fs.js";
import type { CliOptions, EnvironmentInfo } from "../src/types.js";

const environment: EnvironmentInfo = {
  platform: "darwin",
  arch: "arm64",
  nodeVersion: "v22.0.0",
  recommendedPackageManager: "pnpm",
  packageManagers: {
    npm: { installed: true, version: "10.5.1", path: "/usr/bin/npm" },
    pnpm: { installed: true, version: "9.0.0", path: "/usr/local/bin/pnpm" },
    yarn: { installed: false },
    bun: { installed: false },
  },
};

const cliOptions: CliOptions = {
  command: "init",
  resume: false,
  skipInstall: true,
  yes: true,
  outputDir: "/tmp/devforge-generator-test",
  projectName: "devforge-generator-test",
};

test("generator returns a runnable default frontend scaffold", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  const files = buildProjectFiles(plan, environment);
  const paths = new Set(files.map((file) => file.path));
  const packageJsonFile = files.find((file) => file.path === "package.json");
  const readmeFile = files.find((file) => file.path === "README.md");
  const appFile = files.find((file) => file.path === "src/App.tsx");

  assert.ok(packageJsonFile);
  assert.ok(readmeFile);
  assert.ok(appFile);

  const packageJson = JSON.parse(packageJsonFile.content) as {
    scripts: Record<string, string>;
    engines: Record<string, string>;
    pnpm?: {
      onlyBuiltDependencies?: string[];
    };
  };

  assert.ok(paths.has("package.json"));
  assert.ok(paths.has("README.md"));
  assert.ok(paths.has("docs/getting-started.md"));
  assert.ok(paths.has(".editorconfig"));
  assert.ok(paths.has(".github/workflows/ci.yml"));
  assert.ok(paths.has("src/App.tsx"));
  assert.ok(paths.has("vitest.config.ts"));
  assert.ok(paths.has("src/__tests__/app.test.ts"));
  assert.ok(paths.has("vite.config.ts"));
  assert.equal(
    packageJson.scripts.check,
    "eslint . && tsc -p tsconfig.json --noEmit && prettier --check . && vite build && vitest run",
  );
  assert.equal(packageJson.engines.node, ">=20.19.0 || >=22.12.0");
  assert.deepEqual(packageJson.pnpm?.onlyBuiltDependencies, ["esbuild"]);
  assert.match(readmeFile.content, /Quick Start/);
  assert.match(readmeFile.content, /Common Commands/);
  assert.match(readmeFile.content, /Command Guide/);
  assert.match(readmeFile.content, /Tooling Defaults/);
  assert.match(readmeFile.content, /devforge\.config\.json/);
  assert.match(readmeFile.content, /devforge init --config \.\/devforge\.config\.json --output \.\/my-app/);
  assert.match(readmeFile.content, /devforge add testing/);
  assert.match(appFile.content, /Project details/);
  assert.match(appFile.content, /Created by Ali-dev11 via @ali-dev11(?:\/|\\u002F)devforge/);
  assert.match(
    files.find((file) => file.path === "vite.config.ts")?.content ?? "",
    /@tailwindcss\/vite/,
  );
});

test("fullstack scripts honor the selected package manager", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.intent = "fullstack-app";
  applyIntentDefaults(plan);

  const files = buildProjectFiles(plan, environment);
  const packageJsonFile = files.find((file) => file.path === "package.json");
  const serverTsconfigFile = files.find((file) => file.path === "tsconfig.server.json");

  assert.ok(packageJsonFile);
  assert.ok(serverTsconfigFile);

  const packageJson = JSON.parse(packageJsonFile.content) as {
    scripts: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts.dev,
    'concurrently -n web,api "pnpm run dev:web" "pnpm run dev:api"',
  );
  assert.equal(
    packageJson.scripts.build,
    "pnpm run build:web && pnpm run build:api",
  );
  assert.equal(packageJson.scripts["build:api"], "tsc -p tsconfig.server.json");
  assert.equal(packageJson.scripts["start:api"], "node dist-api/src/server.js");
  assert.match(serverTsconfigFile.content, /"dist-api"/);
});

test("workspace scaffolds local tsconfig files, app tests, and root tooling dependencies", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.intent = "fullstack-app";
  plan.architecture = "monorepo";
  applyIntentDefaults(plan);
  plan.testing.runner = "jest";
  plan.testing.environment = "node";

  const files = buildProjectFiles(plan, environment);
  const paths = new Set(files.map((file) => file.path));
  const rootPackageJsonFile = files.find((file) => file.path === "package.json");

  assert.ok(rootPackageJsonFile);

  const rootPackageJson = JSON.parse(rootPackageJsonFile.content) as {
    scripts: Record<string, string>;
    devDependencies: Record<string, string>;
    packageManager: string;
  };
  const webTsconfig = files.find((file) => file.path === "apps/web/tsconfig.json");
  const apiTsconfig = files.find((file) => file.path === "apps/api/tsconfig.json");

  assert.ok(paths.has("apps/web/tsconfig.json"));
  assert.ok(paths.has("apps/api/tsconfig.json"));
  assert.ok(paths.has("apps/web/jest.config.cjs"));
  assert.ok(paths.has("apps/api/jest.config.cjs"));
  assert.match(webTsconfig?.content ?? "", /"types": \[/);
  assert.match(apiTsconfig?.content ?? "", /"node"/);
  assert.equal(rootPackageJson.scripts.test, "turbo run test");
  assert.equal(rootPackageJson.packageManager, "pnpm@9.0.0");
  assert.equal(rootPackageJson.devDependencies.typescript, "latest");
  assert.equal(rootPackageJson.devDependencies.eslint, "latest");
  assert.equal(rootPackageJson.devDependencies.turbo, "latest");
});

test("microfrontend scaffolds skip generic workspace apps and include packageManager metadata", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.intent = "microfrontend-system";
  plan.architecture = "microfrontend";
  applyIntentDefaults(plan);

  const files = buildProjectFiles(plan, environment);
  const paths = new Set(files.map((file) => file.path));
  const rootPackageJsonFile = files.find((file) => file.path === "package.json");

  assert.ok(rootPackageJsonFile);

  const rootPackageJson = JSON.parse(rootPackageJsonFile.content) as {
    packageManager: string;
  };
  const hostPackageJson = JSON.parse(
    files.find((file) => file.path === "apps/host/package.json")?.content ?? "{}",
  ) as {
    scripts: Record<string, string>;
  };
  const remotePackageJson = JSON.parse(
    files.find((file) => file.path === "apps/remote-catalog/package.json")?.content ?? "{}",
  ) as {
    scripts: Record<string, string>;
  };

  assert.equal(rootPackageJson.packageManager, "pnpm@9.0.0");
  assert.ok(paths.has("apps/host/package.json"));
  assert.ok(paths.has("apps/remote-catalog/package.json"));
  assert.ok(paths.has("apps/remote-dashboard/package.json"));
  assert.equal(hostPackageJson.scripts.dev, "vite --host 127.0.0.1 --port 4173 --strictPort");
  assert.match(remotePackageJson.scripts.dev, /vite build --watch/);
  assert.match(
    files.find((file) => file.path === "apps/host/vite.config.ts")?.content ?? "",
    /@originjs\/vite-plugin-federation/,
  );
  assert.match(
    files.find((file) => file.path === "apps/host/vite.config.ts")?.content ?? "",
    /http:(?:\/\/|\\u002F\\u002F)127\.0\.0\.1:4174(?:\/|\\u002F)assets(?:\/|\\u002F)remoteEntry\.js/,
  );
  assert.match(
    files.find((file) => file.path === "apps/host/src/App.tsx")?.content ?? "",
    /Load remote/,
  );
  assert.match(
    files.find((file) => file.path === "apps/remote-catalog/src/RemoteApp.tsx")?.content ?? "",
    /Federated remote/,
  );
  assert.equal(paths.has("apps/web/package.json"), false);
});

test("backend, cli, and extension scaffolds expose project metadata surfaces", () => {
  const backendPlan = buildDefaultPlan(environment, cliOptions);
  backendPlan.intent = "backend-api";
  applyIntentDefaults(backendPlan);

  const backendFiles = buildProjectFiles(backendPlan, environment);
  const backendServer = backendFiles.find((file) => file.path === "src/server.ts");

  assert.ok(backendServer);
  assert.match(backendServer.content, /generatedBy/);
  assert.match(backendServer.content, /packageName/);
  assert.match(backendServer.content, /app\.get\("\/health"/);

  const cliPlan = buildDefaultPlan(environment, cliOptions);
  cliPlan.intent = "cli-tool";
  applyIntentDefaults(cliPlan);

  const cliFiles = buildProjectFiles(cliPlan, environment);
  const cliEntry = cliFiles.find((file) => file.path === "src/index.ts");

  assert.ok(cliEntry);
  assert.match(cliEntry.content, /--json/);
  assert.match(cliEntry.content, /generatedBy/);

  const extensionPlan = buildDefaultPlan(environment, cliOptions);
  extensionPlan.intent = "chrome-extension";
  applyIntentDefaults(extensionPlan);

  const extensionFiles = buildProjectFiles(extensionPlan, environment);
  const popupFile = extensionFiles.find((file) => file.path === "src/popup.tsx");
  const backgroundFile = extensionFiles.find((file) => file.path === "src/background.ts");

  assert.ok(popupFile);
  assert.ok(backgroundFile);
  assert.match(popupFile.content, /Extension details/);
  assert.match(popupFile.content, /Created by Ali-dev11 via @ali-dev11(?:\/|\\u002F)devforge/);
  assert.match(backgroundFile.content, /extensionInfo/);
});

test("generator sanitizes user text before embedding it into generated source code", () => {
  const unsafeProjectName = "unsafe </script> name";
  const unsafeDescription = "description </script><img src=x onerror=alert(1)>";

  const nextPlan = buildDefaultPlan(environment, {
    ...cliOptions,
    projectName: unsafeProjectName,
  });
  nextPlan.projectName = unsafeProjectName;
  nextPlan.metadata.description = unsafeDescription;
  nextPlan.frontend = {
    framework: "nextjs",
    rendering: "ssr",
    styling: "vanilla-css",
    uiLibrary: "none",
    state: "none",
    dataFetching: "native-fetch",
  };

  const nextFiles = buildProjectFiles(nextPlan, environment);
  const nextLayoutFile = nextFiles.find((file) => file.path === "app/layout.tsx");
  assert.ok(nextLayoutFile);
  assert.match(nextLayoutFile.content, /\\u003C/);
  assert.doesNotMatch(nextLayoutFile.content, /<\/script>/);
  assert.doesNotMatch(nextLayoutFile.content, /<img src=x onerror=alert\(1\)>/);

  const remixPlan = buildDefaultPlan(environment, {
    ...cliOptions,
    projectName: unsafeProjectName,
  });
  remixPlan.projectName = unsafeProjectName;
  remixPlan.metadata.description = unsafeDescription;
  remixPlan.frontend = {
    framework: "remix",
    rendering: "ssr",
    styling: "vanilla-css",
    uiLibrary: "none",
    state: "none",
    dataFetching: "native-fetch",
  };

  const remixFiles = buildProjectFiles(remixPlan, environment);
  const remixRootFile = remixFiles.find((file) => file.path === "app/root.tsx");
  assert.ok(remixRootFile);
  assert.match(remixRootFile.content, /\\u003C/);
  assert.doesNotMatch(remixRootFile.content, /<\/script>/);

  const cliPlan = buildDefaultPlan(environment, {
    ...cliOptions,
    projectName: unsafeProjectName,
  });
  cliPlan.intent = "cli-tool";
  cliPlan.projectName = unsafeProjectName;
  cliPlan.metadata.description = unsafeDescription;
  applyIntentDefaults(cliPlan);

  const cliFiles = buildProjectFiles(cliPlan, environment);
  const cliEntryFile = cliFiles.find((file) => file.path === "src/index.ts");
  assert.ok(cliEntryFile);
  assert.match(cliEntryFile.content, /\\u003C/);
  assert.doesNotMatch(cliEntryFile.content, /<\/script>/);
  assert.doesNotMatch(cliEntryFile.content, /<img src=x onerror=alert\(1\)>/);
});

test("nextjs scaffolds include next type support and css-safe typecheck setup", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.frontend = {
    framework: "nextjs",
    rendering: "ssr",
    styling: "vanilla-css",
    uiLibrary: "none",
    state: "none",
    dataFetching: "native-fetch",
  };

  const files = buildProjectFiles(plan, environment);
  const tsconfigFile = files.find((file) => file.path === "tsconfig.json");
  const nextEnvFile = files.find((file) => file.path === "next-env.d.ts");

  assert.ok(tsconfigFile);
  assert.ok(nextEnvFile);
  assert.match(tsconfigFile.content, /"next-env\.d\.ts"/);
  assert.match(tsconfigFile.content, /"name": "next"/);
  assert.match(nextEnvFile.content, /reference types="next"/);
});

test("remix bun scaffolds include runtime guidance, CLI dependencies, and typed-lint overrides", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.packageManager = "bun";
  plan.nodeStrategy = "custom";
  plan.customNodeVersion = "23";
  plan.frontend = {
    framework: "remix",
    rendering: "ssr",
    styling: "tailwind-css",
    uiLibrary: "chakra-ui",
    state: "jotai",
    dataFetching: "apollo-client",
  };
  plan.testing = {
    enabled: true,
    runner: "playwright",
    environment: "browser-e2e",
    includeExampleTests: true,
  };

  const files = buildProjectFiles(plan, environment);
  const packageJsonFile = files.find((file) => file.path === "package.json");
  const readmeFile = files.find((file) => file.path === "README.md");
  const gettingStartedFile = files.find((file) => file.path === "docs/getting-started.md");
  const eslintConfigFile = files.find((file) => file.path === "eslint.config.js");
  const playwrightConfigFile = files.find((file) => file.path === "playwright.config.ts");
  const viteConfigFile = files.find((file) => file.path === "vite.config.ts");
  const entryClientFile = files.find((file) => file.path === "app/entry.client.tsx");
  const entryServerFile = files.find((file) => file.path === "app/entry.server.tsx");
  const postcssConfigFile = files.find((file) => file.path === "postcss.config.mjs");

  assert.ok(packageJsonFile);
  assert.ok(readmeFile);
  assert.ok(gettingStartedFile);
  assert.ok(eslintConfigFile);
  assert.ok(playwrightConfigFile);
  assert.ok(viteConfigFile);
  assert.ok(entryClientFile);
  assert.ok(entryServerFile);
  assert.equal(postcssConfigFile, undefined);

  const packageJson = JSON.parse(packageJsonFile.content) as {
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    packageManager: string;
  };

  assert.match(packageJson.packageManager, /^bun@/);
  assert.equal(packageJson.scripts.dev, "remix vite:dev");
  assert.equal(packageJson.scripts.build, "remix vite:build");
  assert.equal(packageJson.devDependencies["@remix-run/dev"], "latest");
  assert.equal(packageJson.devDependencies.vite, "latest");
  assert.equal(packageJson.devDependencies["vite-tsconfig-paths"], "latest");
  assert.equal(packageJson.devDependencies["@tailwindcss/vite"], "latest");
  assert.equal(packageJson.devDependencies["@tailwindcss/postcss"], undefined);
  assert.equal(packageJson.dependencies["@remix-run/react"], "latest");
  assert.match(viteConfigFile.content, /vitePlugin as remix/);
  assert.match(viteConfigFile.content, /@tailwindcss\/vite/);
  assert.match(viteConfigFile.content, /plugins: \[remix\(\), tsconfigPaths\(\), tailwindcss\(\)\]/);
  assert.match(eslintConfigFile.content, /\*\*\/\*\.\{ts,tsx,mts,cts\}/);
  assert.match(eslintConfigFile.content, /projectService: true/);
  assert.match(eslintConfigFile.content, /\*\*\/\*\.\{js,mjs,cjs\}/);
  assert.match(playwrightConfigFile.content, /command: "bun run dev"/);
  assert.match(playwrightConfigFile.content, /baseURL: "http:(?:\/\/|\\u002F\\u002F)localhost:3000"/);
  assert.match(readmeFile.content, /First Run Requirements/);
  assert.match(readmeFile.content, /Install Bun on each machine/);
  assert.match(readmeFile.content, /Recommended Setup/);
  assert.match(readmeFile.content, /npx playwright install/);
  assert.match(readmeFile.content, /bun run dev/);
  assert.match(readmeFile.content, /bun run build/);
  assert.match(readmeFile.content, /devforge init --save-config/);
  assert.match(readmeFile.content, /devforge add docker/);
  assert.match(readmeFile.content, /instead of raw package-manager bundler commands/i);
  assert.match(gettingStartedFile.content, /One-Time Requirements/);
  assert.match(gettingStartedFile.content, /Recommended Setup/);
  assert.match(gettingStartedFile.content, /nvm use/);
  assert.match(gettingStartedFile.content, /devforge init --config \.\/devforge\.config\.json --output \.\/my-app/);
  assert.match(gettingStartedFile.content, /devforge add github-actions/);
});

test("playwright docs and commands stay package-manager aware", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.packageManager = "pnpm";
  plan.testing = {
    enabled: true,
    runner: "playwright",
    environment: "browser-e2e",
    includeExampleTests: true,
  };

  const files = buildProjectFiles(plan, environment);
  const readmeFile = files.find((file) => file.path === "README.md");
  const gettingStartedFile = files.find((file) => file.path === "docs/getting-started.md");
  const playwrightConfigFile = files.find((file) => file.path === "playwright.config.ts");

  assert.ok(readmeFile);
  assert.ok(gettingStartedFile);
  assert.ok(playwrightConfigFile);

  assert.match(readmeFile.content, /pnpm install/);
  assert.match(readmeFile.content, /pnpm run dev/);
  assert.match(readmeFile.content, /pnpm run check/);
  assert.match(readmeFile.content, /devforge init --save-config/);
  assert.match(gettingStartedFile.content, /devforge add ai-rules/);
  assert.match(gettingStartedFile.content, /npx playwright install/);
  assert.match(gettingStartedFile.content, /devforge init --config \.\/devforge\.config\.json --output \.\/my-app/);
  assert.match(playwrightConfigFile.content, /command: "pnpm run dev"/);
});

test("jest scaffolds emit runnable cjs config for TypeScript projects", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.intent = "chrome-extension";
  applyIntentDefaults(plan);
  plan.testing = {
    enabled: true,
    runner: "jest",
    environment: "jsdom",
    includeExampleTests: true,
  };

  const files = buildProjectFiles(plan, environment);
  const jestConfigFile = files.find((file) => file.path === "jest.config.cjs");

  assert.ok(jestConfigFile);
  assert.equal(files.some((file) => file.path === "jest.config.ts"), false);
  assert.match(jestConfigFile.content, /module\.exports = config/);
  assert.match(jestConfigFile.content, /ts-jest/);
  assert.match(jestConfigFile.content, /extensionsToTreatAsEsm/);
  assert.match(jestConfigFile.content, /ignoreCodes: \[151002, 5107\]/);
  const exampleTest = files.find((file) => file.path === "src/__tests__/starter.test.ts");
  assert.ok(exampleTest);
  assert.match(exampleTest.content, /reference types="jest"/);
});

test("supported deployment targets generate target-specific files and docs", () => {
  const reactPlan = buildDefaultPlan(environment, cliOptions);
  reactPlan.intent = "frontend-app";
  reactPlan.frontend = {
    framework: "react-vite",
    rendering: "client",
    styling: "tailwind-css",
    uiLibrary: "shadcn-ui",
    state: "zustand",
    dataFetching: "tanstack-query",
  };
  reactPlan.deployment.target = "netlify";

  const reactFiles = buildProjectFiles(reactPlan, environment);
  const netlifyFile = reactFiles.find((file) => file.path === "netlify.toml");
  const reactReadme = reactFiles.find((file) => file.path === "README.md");

  assert.ok(netlifyFile);
  assert.ok(reactReadme);
  assert.match(netlifyFile.content, /publish = "dist"/);
  assert.match(reactReadme.content, /Deployment target: Netlify/);

  const renderFrontendPlan = buildDefaultPlan(environment, cliOptions);
  renderFrontendPlan.intent = "frontend-app";
  renderFrontendPlan.frontend = {
    framework: "react-vite",
    rendering: "client",
    styling: "tailwind-css",
    uiLibrary: "shadcn-ui",
    state: "zustand",
    dataFetching: "tanstack-query",
  };
  renderFrontendPlan.deployment.target = "render";
  renderFrontendPlan.tooling.githubActions = true;

  const renderFrontendFiles = buildProjectFiles(renderFrontendPlan, environment);
  const renderYaml = renderFrontendFiles.find((file) => file.path === "render.yaml");
  const renderWorkflow = renderFrontendFiles.find((file) => file.path === ".github/workflows/deploy.yml");

  assert.ok(renderYaml);
  assert.ok(renderWorkflow);
  assert.match(renderYaml.content, /runtime: static/);
  assert.match(renderYaml.content, /staticPublishPath: dist/);
  assert.match(renderWorkflow.content, /RENDER_DEPLOY_HOOK_URL/);

  const nextPlan = buildDefaultPlan(environment, cliOptions);
  nextPlan.intent = "frontend-app";
  nextPlan.frontend = {
    framework: "nextjs",
    rendering: "ssr",
    styling: "vanilla-css",
    uiLibrary: "none",
    state: "none",
    dataFetching: "native-fetch",
  };
  nextPlan.deployment.target = "vercel";

  const nextFiles = buildProjectFiles(nextPlan, environment);
  const vercelFile = nextFiles.find((file) => file.path === "vercel.json");
  const deployWorkflow = nextFiles.find((file) => file.path === ".github/workflows/deploy.yml");

  assert.ok(vercelFile);
  assert.ok(deployWorkflow);
  assert.match(deployWorkflow.content, /vercel deploy --prebuilt --prod/);

  const railwayPlan = buildDefaultPlan(environment, cliOptions);
  railwayPlan.intent = "frontend-app";
  railwayPlan.frontend = {
    framework: "nextjs",
    rendering: "ssr",
    styling: "vanilla-css",
    uiLibrary: "none",
    state: "none",
    dataFetching: "native-fetch",
  };
  railwayPlan.deployment.target = "railway";
  railwayPlan.tooling.githubActions = true;

  const railwayFiles = buildProjectFiles(railwayPlan, environment);
  const railwayConfigFile = railwayFiles.find((file) => file.path === "railway.toml");
  const railwayWorkflow = railwayFiles.find((file) => file.path === ".github/workflows/deploy.yml");
  const railwayPackageJson = railwayFiles.find((file) => file.path === "package.json");

  assert.ok(railwayConfigFile);
  assert.ok(railwayWorkflow);
  assert.ok(railwayPackageJson);
  assert.match(railwayConfigFile.content, /\[deploy\]/);
  assert.match(railwayConfigFile.content, /startCommand = "pnpm run start"/);
  assert.match(railwayWorkflow.content, /railway up --ci/);
  assert.match(railwayPackageJson.content, /next start --hostname 0\.0\.0\.0/);

  const backendPlan = buildDefaultPlan(environment, cliOptions);
  backendPlan.intent = "backend-api";
  applyIntentDefaults(backendPlan);
  backendPlan.backend = {
    framework: "fastify",
    language: "typescript",
    auth: [],
    orm: "none",
    database: "none",
    redis: false,
    swagger: true,
    websockets: false,
  };
  backendPlan.deployment.target = "docker-compose";
  backendPlan.tooling.docker = true;

  const backendFiles = buildProjectFiles(backendPlan, environment);
  const composeFile = backendFiles.find((file) => file.path === "docker-compose.yml");
  const dockerfile = backendFiles.find((file) => file.path === "Dockerfile");

  assert.ok(composeFile);
  assert.ok(dockerfile);
  assert.match(composeFile.content, /3001:3001/);
  assert.match(dockerfile.content, /CMD \["pnpm","run","start"\]/);

  const renderBackendPlan = buildDefaultPlan(environment, cliOptions);
  renderBackendPlan.intent = "backend-api";
  applyIntentDefaults(renderBackendPlan);
  renderBackendPlan.backend = {
    framework: "fastify",
    language: "typescript",
    auth: [],
    orm: "none",
    database: "none",
    redis: false,
    swagger: true,
    websockets: false,
  };
  renderBackendPlan.deployment.target = "render";
  renderBackendPlan.tooling.githubActions = true;

  const renderBackendFiles = buildProjectFiles(renderBackendPlan, environment);
  const renderBackendYaml = renderBackendFiles.find((file) => file.path === "render.yaml");
  const backendServer = renderBackendFiles.find((file) => file.path === "src/server.ts");

  assert.ok(renderBackendYaml);
  assert.ok(backendServer);
  assert.match(renderBackendYaml.content, /runtime: node/);
  assert.match(renderBackendYaml.content, /healthCheckPath: \/health/);
  assert.match(renderBackendYaml.content, /HOST/);
  assert.match(backendServer.content, /const host = process\.env\.HOST \?\? "0\.0\.0\.0"/);
});

test("nestjs and javascript backend scaffolds include compatible build settings", () => {
  const nestPlan = buildDefaultPlan(environment, cliOptions);
  nestPlan.intent = "backend-api";
  applyIntentDefaults(nestPlan);
  nestPlan.backend = {
    framework: "nestjs",
    language: "typescript",
    adapter: "fastify",
    auth: [],
    orm: "none",
    database: "none",
    redis: false,
    swagger: false,
    websockets: false,
  };

  const nestFiles = buildProjectFiles(nestPlan, environment);
  const nestTsconfig = nestFiles.find((file) => file.path === "tsconfig.json");
  const nestPackageJsonFile = nestFiles.find((file) => file.path === "package.json");
  const nestServerFile = nestFiles.find((file) => file.path === "src/server.ts");

  assert.ok(nestTsconfig);
  assert.ok(nestPackageJsonFile);
  assert.ok(nestServerFile);
  assert.match(nestTsconfig.content, /"experimentalDecorators": true/);
  assert.match(nestTsconfig.content, /"emitDecoratorMetadata": true/);
  assert.match(nestPackageJsonFile.content, /@nestjs\/platform-fastify/);
  assert.doesNotMatch(nestPackageJsonFile.content, /@nestjs\/platform-express/);
  assert.match(nestServerFile.content, /FastifyAdapter/);
  assert.match(nestServerFile.content, /NestFastifyApplication/);
  assert.match(nestServerFile.content, /new FastifyAdapter\(\)/);

  const jsBackendPlan = buildDefaultPlan(environment, cliOptions);
  jsBackendPlan.intent = "backend-api";
  applyIntentDefaults(jsBackendPlan);
  jsBackendPlan.backend = {
    framework: "koa",
    language: "javascript",
    auth: [],
    orm: "none",
    database: "none",
    redis: false,
    swagger: false,
    websockets: false,
  };

  const jsBackendFiles = buildProjectFiles(jsBackendPlan, environment);
  const jsPackageJsonFile = jsBackendFiles.find((file) => file.path === "package.json");

  assert.ok(jsPackageJsonFile);
  const jsPackageJson = JSON.parse(jsPackageJsonFile.content) as {
    scripts: Record<string, string>;
  };
  assert.match(jsPackageJson.scripts.build, /does not require compilation/);
});

test("backend capability selections are documented as starter baselines in generated docs", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.intent = "backend-api";
  applyIntentDefaults(plan);
  plan.backend = {
    framework: "nestjs",
    language: "typescript",
    adapter: "fastify",
    auth: ["jwt", "oauth"],
    orm: "drizzle",
    database: "postgresql",
    redis: true,
    swagger: true,
    websockets: true,
  };

  const files = buildProjectFiles(plan, environment);
  const readmeFile = files.find((file) => file.path === "README.md");
  const gettingStartedFile = files.find((file) => file.path === "docs/getting-started.md");

  assert.ok(readmeFile);
  assert.ok(gettingStartedFile);
  assert.match(readmeFile.content, /Finish backend capability baselines before shipping/);
  assert.match(readmeFile.content, /starter baselines, not full implementations/);
  assert.match(gettingStartedFile.content, /Finish backend capability baselines before shipping/);
});

test("lts and latest node strategies do not emit a version-manager file", () => {
  const ltsPlan = buildDefaultPlan(environment, cliOptions);
  const latestPlan = buildDefaultPlan(environment, cliOptions);
  latestPlan.nodeStrategy = "latest";

  const ltsPaths = new Set(buildProjectFiles(ltsPlan, environment).map((file) => file.path));
  const latestPaths = new Set(buildProjectFiles(latestPlan, environment).map((file) => file.path));

  assert.equal(ltsPaths.has(".nvmrc"), false);
  assert.equal(latestPaths.has(".nvmrc"), false);
});

test("custom node strategy emits a version-manager file", () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  plan.nodeStrategy = "custom";
  plan.customNodeVersion = "22.12.0";

  const nvmrcFile = buildProjectFiles(plan, environment).find((file) => file.path === ".nvmrc");

  assert.ok(nvmrcFile);
  assert.equal(nvmrcFile.content, "22.12.0\n");
});

test("all intents emit a primary starter surface", () => {
  const expectations: Array<{
    intent: "landing-page" | "frontend-app" | "backend-api" | "fullstack-app" | "microfrontend-system" | "chrome-extension" | "cli-tool";
    paths: string[];
    architecture?: "microfrontend";
  }> = [
    { intent: "landing-page", paths: ["src/App.tsx", "README.md"] },
    { intent: "frontend-app", paths: ["src/App.tsx", "README.md"] },
    { intent: "backend-api", paths: ["src/server.ts", "README.md"] },
    { intent: "fullstack-app", paths: ["src/App.tsx", "src/server.ts", "README.md"] },
    {
      intent: "microfrontend-system",
      architecture: "microfrontend",
      paths: ["apps/host/src/App.tsx", "apps/remote-catalog/src/App.tsx", "docs/microfrontends.md"],
    },
    { intent: "chrome-extension", paths: ["public/manifest.json", "src/popup.tsx", "README.md"] },
    { intent: "cli-tool", paths: ["src/index.ts", "README.md"] },
  ];

  for (const expectation of expectations) {
    const plan = buildDefaultPlan(environment, cliOptions);
    plan.intent = expectation.intent;
    if (expectation.architecture) {
      plan.architecture = expectation.architecture;
    }
    applyIntentDefaults(plan);

    const files = buildProjectFiles(plan, environment);
    const paths = new Set(files.map((file) => file.path));

    for (const expectedPath of expectation.paths) {
      assert.ok(paths.has(expectedPath), `${expectation.intent} should include ${expectedPath}`);
    }
  }
});

test("generateProject rejects file targets that are not directories", async () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  const tempDir = await mkdtemp(join(tmpdir(), "devforge-file-target-"));
  const blockedPath = join(tempDir, "blocked");

  await writeFile(blockedPath, "not a directory", "utf8");
  plan.targetDir = blockedPath;

  await assert.rejects(
    generateProject(plan, environment),
    /Target path is not a directory/,
  );
});

test("generateProject reports file write progress", async () => {
  const plan = buildDefaultPlan(environment, cliOptions);
  const tempDir = await mkdtemp(join(tmpdir(), "devforge-progress-"));
  plan.targetDir = join(tempDir, "project");

  const events: Array<{ current: number; total: number }> = [];

  const result = await generateProject(plan, environment, {
    onWrite(info) {
      events.push({ current: info.current, total: info.total });
    },
  });

  assert.ok(events.length > 0);
  assert.equal(events.at(-1)?.current, events.at(-1)?.total);
  assert.equal(events.at(-1)?.current, result.filesWritten.length + 1);
});

test("writeGeneratedFiles blocks duplicate and escaping output paths", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "devforge-write-"));

  await assert.rejects(
    writeGeneratedFiles(tempDir, [
      { path: "README.md", content: "a" },
      { path: "README.md", content: "b" },
    ]),
    /Duplicate generated file path/,
  );

  await assert.rejects(
    writeGeneratedFiles(tempDir, [{ path: "../escape.txt", content: "x" }]),
    /outside the target directory/,
  );
});
