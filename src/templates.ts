import type {
  BackendFramework,
  EnvironmentInfo,
  FrontendFramework,
  GeneratedFile,
  NestAdapter,
  PackageManager,
  PackageManagerMetadata,
  ProjectPlan,
} from "./types.js";
import { generatedProjectNodeEngine } from "./utils/node-compat.js";
import { joinSentence, toConstantCase, toTitleCase } from "./utils/strings.js";
import {
  DEVFORGE_AUTHOR,
  DEVFORGE_PACKAGE_NAME,
  DEVFORGE_VERSION,
} from "./version.js";

type PackageJsonShape = {
  name: string;
  version: string;
  private?: boolean;
  type?: "module";
  packageManager?: string;
  pnpm?: {
    onlyBuiltDependencies?: string[];
  };
  scripts?: Record<string, string>;
  workspaces?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
};

type ProjectDetailEntry = {
  label: string;
  value: string;
};

type FrontendSurfaceContext = {
  badge?: string;
  heading?: string;
  lead?: string;
  extraDetails?: ProjectDetailEntry[];
};

function stringifyJson(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function makeFile(path: string, content: string, executable = false): GeneratedFile {
  return { path, content, executable };
}

function pnpmPackageConfig(plan: ProjectPlan): PackageJsonShape["pnpm"] | undefined {
  if (
    plan.packageManager === "pnpm" &&
    (Boolean(plan.frontend) || plan.intent === "chrome-extension" || plan.architecture === "microfrontend")
  ) {
    return {
      onlyBuiltDependencies: ["esbuild"],
    };
  }

  return undefined;
}

function microfrontendPort(index: number): number {
  return 4173 + index;
}

function microfrontendRemoteModuleName(remoteApp: string): string {
  return `remote_${remoteApp.replace(/-/g, "_")}`;
}

function microfrontendRemoteEntryUrl(port: number): string {
  return `http://127.0.0.1:${port}/assets/remoteEntry.js`;
}

function isReactLike(plan: ProjectPlan): boolean {
  return ["nextjs", "react-vite", "remix"].includes(plan.frontend?.framework ?? "");
}

function usesTypeScript(plan: ProjectPlan): boolean {
  if (plan.intent === "backend-api" && plan.backend?.language === "javascript") {
    return false;
  }

  return true;
}

function backendUsesTypeScript(plan: ProjectPlan): boolean {
  return plan.backend?.language !== "javascript";
}

function nodeVersionSpec(plan: ProjectPlan): string {
  if (plan.nodeStrategy === "custom" && plan.customNodeVersion) {
    return plan.customNodeVersion;
  }

  if (plan.nodeStrategy === "latest") {
    return "node";
  }

  return "lts/*";
}

function shouldGenerateNodeVersionFile(plan: ProjectPlan): boolean {
  return plan.nodeStrategy === "custom" && Boolean(plan.customNodeVersion);
}

function packageManagerInstallCommand(packageManager: PackageManager): string {
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

function packageManagerCiInstallCommand(packageManager: PackageManager): string {
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

function packageManagerRunCommand(packageManager: PackageManager, script: string): string {
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

function editorConfigContent(): string {
  return [
    "root = true",
    "",
    "[*]",
    "charset = utf-8",
    "end_of_line = lf",
    "indent_style = space",
    "indent_size = 2",
    "insert_final_newline = true",
    "trim_trailing_whitespace = true",
    "",
    "[*.md]",
    "trim_trailing_whitespace = false",
    "",
  ].join("\n");
}

function rootGitignore(): string {
  return [
    "node_modules",
    "dist",
    ".DS_Store",
    ".env",
    ".env.local",
    ".turbo",
    ".nx",
    ".next",
    "coverage",
    "*.log",
  ].join("\n");
}

function isNextJsPlan(plan: ProjectPlan): boolean {
  return plan.frontend?.framework === "nextjs";
}

function isBrowserLikePlan(plan: ProjectPlan): boolean {
  return Boolean(plan.frontend) || plan.intent === "chrome-extension";
}

function nodeTsConfig(
  plan: ProjectPlan,
  include: string[],
  options?: { outDir?: string; rootDir?: string },
): string {
  const compilerOptions: Record<string, unknown> = {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    types: ["node"],
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
    outDir: options?.outDir ?? "dist",
    rootDir: options?.rootDir ?? ".",
  };

  if (plan.backend?.framework === "nestjs") {
    compilerOptions.experimentalDecorators = true;
    compilerOptions.emitDecoratorMetadata = true;
  }

  return stringifyJson({
    compilerOptions,
    include,
  });
}

function browserTsConfig(plan: ProjectPlan, include: string[]): string {
  const compilerOptions: Record<string, unknown> = {
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "Bundler",
    lib: ["ES2022", "DOM", "DOM.Iterable"],
    types: plan.intent === "chrome-extension" ? ["chrome", "node"] : ["node"],
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
    noEmit: true,
    isolatedModules: true,
  };

  if (
    plan.frontend?.framework === "react-vite" ||
    plan.frontend?.framework === "remix" ||
    (plan.intent === "chrome-extension" && plan.extension?.flavor === "react")
  ) {
    compilerOptions.jsx = "react-jsx";
  }

  if (plan.frontend?.framework === "solidjs") {
    compilerOptions.jsx = "preserve";
    compilerOptions.jsxImportSource = "solid-js";
  }

  return stringifyJson({
    compilerOptions,
    include,
  });
}

function nextTsConfig(): string {
  return stringifyJson({
    compilerOptions: {
      target: "ES2022",
      lib: ["DOM", "DOM.Iterable", "ESNext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "ESNext",
      moduleResolution: "Bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  });
}

function rootTsConfig(plan: ProjectPlan): string {
  if (isNextJsPlan(plan)) {
    return nextTsConfig();
  }

  if (isBrowserLikePlan(plan)) {
    return browserTsConfig(plan, ["src", "app", "**/*.d.ts"]);
  }

  return nodeTsConfig(plan, ["src", "app", "apps", "packages", "**/*.d.ts"]);
}

function localTsConfig(
  plan: ProjectPlan,
  include: string[] = ["src", "app", "tests", "cypress", "**/*.d.ts"],
): string {
  if (isBrowserLikePlan(plan)) {
    return browserTsConfig(plan, include);
  }

  return nodeTsConfig(plan, include);
}

function generatedProjectVersion(): string {
  return "0.1.0";
}

function generatedWithText(): string {
  return `Created by ${DEVFORGE_AUTHOR} via ${DEVFORGE_PACKAGE_NAME} v${DEVFORGE_VERSION}`;
}

function viteEnvTypesFile(): GeneratedFile {
  return makeFile("src/vite-env.d.ts", '/// <reference types="vite/client" />\n');
}

function projectDetailsEntries(
  plan: ProjectPlan,
  extraDetails: ProjectDetailEntry[] = [],
): ProjectDetailEntry[] {
  return [
    { label: "Intent", value: toTitleCase(plan.intent) },
    { label: "Architecture", value: toTitleCase(plan.architecture) },
    { label: "Template tier", value: toTitleCase(plan.templateTier) },
    { label: "Package manager", value: plan.packageManager },
    plan.frontend ? { label: "Frontend", value: toTitleCase(plan.frontend.framework) } : undefined,
    plan.frontend ? { label: "Rendering", value: toTitleCase(plan.frontend.rendering) } : undefined,
    plan.frontend ? { label: "State", value: toTitleCase(plan.frontend.state) } : undefined,
    plan.frontend
      ? { label: "Data layer", value: toTitleCase(plan.frontend.dataFetching) }
      : undefined,
    plan.backend ? { label: "Backend", value: toTitleCase(plan.backend.framework) } : undefined,
    plan.backend ? { label: "Language", value: toTitleCase(plan.backend.language) } : undefined,
    plan.extension
      ? { label: "Extension", value: toTitleCase(plan.extension.flavor) }
      : undefined,
    {
      label: "Testing",
      value: plan.testing.enabled
        ? `${toTitleCase(plan.testing.runner)} (${toTitleCase(plan.testing.environment)})`
        : "Not configured",
    },
    ...extraDetails,
    { label: "Created by", value: DEVFORGE_AUTHOR },
    { label: "Package", value: DEVFORGE_PACKAGE_NAME },
  ].filter(Boolean) as ProjectDetailEntry[];
}

function projectMetadataPayload(
  plan: ProjectPlan,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    project: {
      name: plan.projectName,
      description: plan.metadata.description,
      intent: plan.intent,
      architecture: plan.architecture,
      templateTier: plan.templateTier,
      license: plan.metadata.license,
      packageManager: plan.packageManager,
      nodeStrategy: plan.nodeStrategy,
      customNodeVersion: plan.customNodeVersion,
    },
    stack: {
      frontend: plan.frontend?.framework,
      rendering: plan.frontend?.rendering,
      styling: plan.frontend?.styling,
      state: plan.frontend?.state,
      dataFetching: plan.frontend?.dataFetching,
      backend: plan.backend?.framework,
      backendLanguage: plan.backend?.language,
      extension: plan.extension?.flavor,
      workspaceTool: plan.workspace.tool,
      microfrontendStrategy: plan.workspace.microfrontendStrategy,
      remoteApps: plan.workspace.remoteApps,
    },
    testing: plan.testing.enabled
      ? {
          enabled: true,
          runner: plan.testing.runner,
          environment: plan.testing.environment,
        }
      : { enabled: false },
    generatedBy: {
      githubUser: DEVFORGE_AUTHOR,
      packageName: DEVFORGE_PACKAGE_NAME,
      cliVersion: DEVFORGE_VERSION,
    },
    ...extra,
  };
}

function frontendSurfaceDetails(
  plan: ProjectPlan,
  context?: FrontendSurfaceContext,
): {
  badge: string;
  heading: string;
  lead: string;
  entries: ProjectDetailEntry[];
} {
  return {
    badge: context?.badge ?? "Project details",
    heading: context?.heading ?? toTitleCase(plan.projectName),
    lead: context?.lead ?? plan.metadata.description,
    entries: projectDetailsEntries(plan, context?.extraDetails ?? []),
  };
}

function resolvePackageManagerMetadata(
  packageManager: PackageManager,
  environment: EnvironmentInfo,
): PackageManagerMetadata {
  const detectedVersion = environment.packageManagers[packageManager].version?.replace(/^v/, "");
  const fallbackVersions: Record<PackageManager, string> = {
    npm: "10",
    pnpm: "9",
    yarn: "4",
    bun: "1",
  };

  return {
    name: packageManager,
    version: detectedVersion || fallbackVersions[packageManager],
  };
}

function packageManagerField(metadata: PackageManagerMetadata): string {
  return `${metadata.name}@${metadata.version}`;
}

function licenseText(license: ProjectPlan["metadata"]["license"]): string {
  const year = new Date().getFullYear();

  switch (license) {
    case "Apache-2.0":
      return [
        "Apache License",
        "Version 2.0, January 2004",
        "https://www.apache.org/licenses/",
        "",
        `Copyright ${year} Project Authors`,
        "",
        "Licensed under the Apache License, Version 2.0 (the \"License\");",
        "you may not use this file except in compliance with the License.",
        "You may obtain a copy of the License at",
        "",
        "http://www.apache.org/licenses/LICENSE-2.0",
        "",
        "Unless required by applicable law or agreed to in writing, software",
        "distributed under the License is distributed on an \"AS IS\" BASIS,",
        "WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.",
      ].join("\n");
    case "ISC":
      return [
        `Copyright (c) ${year} Project Authors`,
        "",
        "Permission to use, copy, modify, and/or distribute this software for any",
        "purpose with or without fee is hereby granted, provided that the above",
        "copyright notice and this permission notice appear in all copies.",
        "",
        "THE SOFTWARE IS PROVIDED \"AS IS\" AND THE AUTHOR DISCLAIMS ALL WARRANTIES",
        "WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF",
        "MERCHANTABILITY AND FITNESS.",
      ].join("\n");
    case "Unlicense":
      return [
        "This is free and unencumbered software released into the public domain.",
        "",
        "Anyone is free to copy, modify, publish, use, compile, sell, or",
        "distribute this software, either in source code form or as a compiled",
        "binary, for any purpose, commercial or non-commercial, and by any means.",
      ].join("\n");
    case "Proprietary":
      return [
        "All rights reserved.",
        "",
        "This project is proprietary and confidential. Unauthorized copying,",
        "distribution, or modification is prohibited without written permission.",
      ].join("\n");
    case "MIT":
    default:
      return [
        "MIT License",
        "",
        `Copyright (c) ${year} Project Authors`,
        "",
        "Permission is hereby granted, free of charge, to any person obtaining a copy",
        "of this software and associated documentation files (the \"Software\"), to deal",
        "in the Software without restriction, including without limitation the rights",
        "to use, copy, modify, merge, publish, distribute, sublicense, and/or sell",
        "copies of the Software.",
      ].join("\n");
  }
}

function architectureDoc(plan: ProjectPlan): string {
  const stack = [
    plan.frontend?.framework && `Frontend: ${toTitleCase(plan.frontend.framework)}`,
    plan.backend?.framework && `Backend: ${toTitleCase(plan.backend.framework)}`,
    plan.extension?.flavor && `Extension: ${toTitleCase(plan.extension.flavor)}`,
  ].filter(Boolean) as string[];

  return [
    "# Architecture Decisions",
    "",
    "## Summary",
    `- Project name: ${plan.projectName}`,
    `- Intent: ${toTitleCase(plan.intent)}`,
    `- Architecture: ${toTitleCase(plan.architecture)}`,
    `- Template tier: ${toTitleCase(plan.templateTier)}`,
    `- Package manager: ${plan.packageManager}`,
    `- Node strategy: ${plan.nodeStrategy}${plan.customNodeVersion ? ` (${plan.customNodeVersion})` : ""}`,
    stack.length > 0 ? `- Stack: ${joinSentence(stack)}` : "- Stack: metadata-first blueprint",
    plan.frontend?.state !== undefined ? `- Frontend state: ${toTitleCase(plan.frontend.state)}` : undefined,
    plan.frontend?.dataFetching !== undefined
      ? `- Frontend data layer: ${toTitleCase(plan.frontend.dataFetching)}`
      : undefined,
    plan.testing.enabled
      ? `- Testing: ${toTitleCase(plan.testing.runner)} (${toTitleCase(plan.testing.environment)})`
      : "- Testing: not configured",
    `- Tooling profiles: ESLint ${plan.tooling.eslintProfile}, Prettier ${plan.tooling.prettierProfile}, Husky ${plan.tooling.huskyProfile}`,
    `- AI tooling: ${joinSentence(plan.ai.tools.map(toTitleCase))}`,
    "",
    "## Operating Principles",
    "- Treat this file and `.devforge/project-plan.json` as the canonical record of the selected stack.",
    "- Expand shared packages before duplicating logic across apps or modules.",
    "- Keep environment access in one place and add tests around critical flows before shipping.",
    "",
    "## Follow-Up",
    "- Replace placeholder UI and sample endpoints with product-specific behavior.",
    "- Add framework-native tests and CI gates for the most critical flows.",
    "- Review generated AI rules and tighten them if the team prefers stricter coding policies.",
    "",
  ].join("\n");
}

function readme(plan: ProjectPlan): string {
  const installCommand = packageManagerInstallCommand(plan.packageManager);
  const scripts =
    plan.architecture === "monorepo" || plan.architecture === "microfrontend"
      ? appendQualityScripts(
          plan,
          plan.workspace.tool === "nx"
            ? {
                dev: "nx run-many -t dev",
                build: "nx run-many -t build",
              }
            : {
                dev: "turbo dev",
                build: "turbo build",
              },
        )
      : singlePackageScripts(plan);
  const scriptCommands = [
    scripts.dev ? packageManagerRunCommand(plan.packageManager, "dev") : undefined,
    scripts.build ? packageManagerRunCommand(plan.packageManager, "build") : undefined,
    scripts.check ? packageManagerRunCommand(plan.packageManager, "check") : undefined,
  ].filter(Boolean) as string[];
  const testCommand = scripts.test
    ? packageManagerRunCommand(plan.packageManager, "test")
    : scripts["test:e2e"]
      ? packageManagerRunCommand(plan.packageManager, "test:e2e")
      : undefined;
  const structure =
    plan.architecture === "monorepo" || plan.architecture === "microfrontend"
      ? ["- `apps/`: runnable applications", "- `packages/`: shared code", "- `docs/`: generated project documentation"]
      : ["- `src/` or `app/`: application source", "- `docs/`: generated project documentation", "- `.devforge/`: resolved scaffold plan"];

  return [
    `# ${toTitleCase(plan.projectName)}`,
    "",
    plan.metadata.description,
    "",
    "## Quick Start",
    "```bash",
    installCommand,
    ...scriptCommands.slice(0, 1),
    "```",
    "",
    "## Stack",
    `- Intent: ${toTitleCase(plan.intent)}`,
    `- Architecture: ${toTitleCase(plan.architecture)}`,
    plan.frontend ? `- Frontend: ${toTitleCase(plan.frontend.framework)}` : undefined,
    plan.frontend ? `- State: ${toTitleCase(plan.frontend.state)}` : undefined,
    plan.frontend ? `- Data fetching: ${toTitleCase(plan.frontend.dataFetching)}` : undefined,
    plan.backend ? `- Backend: ${toTitleCase(plan.backend.framework)}` : undefined,
    plan.extension ? `- Extension: ${toTitleCase(plan.extension.flavor)}` : undefined,
    plan.testing.enabled
      ? `- Testing: ${toTitleCase(plan.testing.runner)} (${toTitleCase(plan.testing.environment)})`
      : "- Testing: not configured",
    `- Tooling profiles: ESLint ${plan.tooling.eslintProfile}, Prettier ${plan.tooling.prettierProfile}, Husky ${plan.tooling.huskyProfile}`,
    `- AI rule mode: ${toTitleCase(plan.ai.ruleMode)}`,
    "",
    "## Common Commands",
    "```bash",
    ...scriptCommands,
    ...(testCommand ? [testCommand] : []),
    "```",
    "",
    "## Command Guide",
    scriptCommands[0]
      ? `- \`${scriptCommands[0]}\` starts the local development surface so you can inspect the generated app, API, workspace, or CLI wiring immediately.`
      : undefined,
    scriptCommands[1]
      ? `- \`${scriptCommands[1]}\` produces a production build and is the fastest way to catch framework or bundler issues before shipping changes.`
      : undefined,
    testCommand
      ? `- \`${testCommand}\` validates the generated test harness so your project starts with a working quality gate instead of a placeholder script.`
      : undefined,
    scriptCommands[2]
      ? `- \`${scriptCommands[2]}\` runs the scaffold's combined validation flow for linting, type safety, formatting, tests, and build checks where applicable.`
      : undefined,
    "",
    "## Tooling Defaults",
    `- ESLint: ${plan.tooling.eslint ? `enabled (${plan.tooling.eslintProfile}) to keep code quality guardrails on from day one.` : "disabled. Enable it later if the team wants lint-driven feedback."}`,
    `- Prettier: ${plan.tooling.prettier ? `enabled (${plan.tooling.prettierProfile}) so formatting stays consistent across contributors and AI assistants.` : "disabled. Add it when the team wants enforced formatting conventions."}`,
    `- Husky: ${plan.tooling.husky ? `enabled (${plan.tooling.huskyProfile}) to enforce checks before commits land locally.` : "disabled by default because local git hooks are team-policy specific and not every project wants them."}`,
    `- Commitlint: ${plan.tooling.commitlint ? "enabled to keep commit messages consistent with release tooling." : "disabled unless you explicitly opt into commit-message enforcement."}`,
    "",
    "## Project Structure",
    ...structure,
    "",
    "## Generated Outputs",
    "- `.devforge/project-plan.json` captures the resolved scaffold decisions.",
    "- `docs/architecture.md` documents the architectural intent.",
    "- `docs/getting-started.md` summarizes setup and first customization steps.",
    "- `docs/ai-rules-sources.md` shows which rule packs map to this stack.",
    "- `AGENTS.md` and optional tool-specific directories contain AI rules.",
    "",
    "## Next Steps",
    "1. Replace placeholder files with your domain-specific UI, routes, and business logic.",
    "2. Review the generated docs and adjust stack decisions if the project direction changes.",
    "3. Tighten CI, deployment, and test coverage before the first production release.",
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

function gettingStartedDoc(plan: ProjectPlan): string {
  const scripts =
    plan.architecture === "monorepo" || plan.architecture === "microfrontend"
      ? appendQualityScripts(
          plan,
          plan.workspace.tool === "nx"
            ? {
                dev: "nx run-many -t dev",
                build: "nx run-many -t build",
              }
            : {
                dev: "turbo dev",
                build: "turbo build",
              },
        )
      : singlePackageScripts(plan);
  const scriptCommands = [
    scripts.dev ? packageManagerRunCommand(plan.packageManager, "dev") : undefined,
    scripts.build ? packageManagerRunCommand(plan.packageManager, "build") : undefined,
    scripts.check ? packageManagerRunCommand(plan.packageManager, "check") : undefined,
  ].filter(Boolean) as string[];
  const testCommand = scripts.test
    ? packageManagerRunCommand(plan.packageManager, "test")
    : scripts["test:e2e"]
      ? packageManagerRunCommand(plan.packageManager, "test:e2e")
      : undefined;

  return [
    "# Getting Started",
    "",
    "## Installation",
    "```bash",
    packageManagerInstallCommand(plan.packageManager),
    "```",
    "",
    "## Daily Commands",
    "```bash",
    ...scriptCommands,
    ...(testCommand ? [testCommand] : []),
    "```",
    "",
    "## Why These Commands Matter",
    scriptCommands[0]
      ? `- \`${scriptCommands[0]}\` is your day-to-day entry point for exploring the generated scaffold and replacing starter content with real features.`
      : undefined,
    scriptCommands[1]
      ? `- \`${scriptCommands[1]}\` checks that production compilation still works before you push or release changes.`
      : undefined,
    testCommand
      ? `- \`${testCommand}\` confirms the generated test setup is still wired correctly after you begin customizing the project.`
      : undefined,
    scriptCommands[2]
      ? `- \`${scriptCommands[2]}\` is the safest pre-push command because it runs the scaffold's combined validation flow.`
      : undefined,
    "",
    "## What To Tackle First",
    "- Replace starter content and placeholder services.",
    "- Fill in environment variables from `.env.example` before wiring external systems.",
    "- Add tests around business-critical flows before the scaffold starts drifting.",
    "",
  ].join("\n");
}

function envExample(plan: ProjectPlan): string {
  const lines = [
    `APP_NAME=${toConstantCase(plan.projectName)}`,
    "NODE_ENV=development",
  ];

  if (plan.backend) {
    lines.push("PORT=3001");
  }

  if (plan.backend?.database === "postgresql") {
    lines.push("DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app");
  }

  if (plan.backend?.database === "mongodb") {
    lines.push("DATABASE_URL=mongodb://localhost:27017/app");
  }

  if (plan.backend?.redis) {
    lines.push("REDIS_URL=redis://localhost:6379");
  }

  if (plan.frontend || plan.intent === "chrome-extension") {
    lines.push("PUBLIC_API_URL=http://localhost:3001");
  }

  return `${lines.join("\n")}\n`;
}

function addRecord(target: Record<string, string>, entries: Record<string, string>): void {
  for (const [key, value] of Object.entries(entries)) {
    target[key] = value;
  }
}

function frontendDependencies(framework: FrontendFramework): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
} {
  switch (framework) {
    case "nextjs":
      return {
        dependencies: {
          next: "latest",
          react: "latest",
          "react-dom": "latest",
        },
        devDependencies: {},
      };
    case "astro":
      return {
        dependencies: {
          astro: "latest",
        },
        devDependencies: {},
      };
    case "remix":
      return {
        dependencies: {
          "@remix-run/node": "latest",
          "@remix-run/react": "latest",
          react: "latest",
          "react-dom": "latest",
        },
        devDependencies: {},
      };
    case "nuxt":
      return {
        dependencies: {
          nuxt: "latest",
          vue: "latest",
        },
        devDependencies: {},
      };
    case "vue-vite":
      return {
        dependencies: {
          vue: "latest",
        },
        devDependencies: {
          vite: "latest",
          "@vitejs/plugin-vue": "latest",
        },
      };
    case "sveltekit":
      return {
        dependencies: {
          svelte: "latest",
          "@sveltejs/kit": "latest",
        },
        devDependencies: {
          vite: "latest",
        },
      };
    case "svelte":
      return {
        dependencies: {
          svelte: "latest",
        },
        devDependencies: {
          vite: "latest",
          "@sveltejs/vite-plugin-svelte": "latest",
        },
      };
    case "solidjs":
      return {
        dependencies: {
          "solid-js": "latest",
        },
        devDependencies: {
          vite: "latest",
          "vite-plugin-solid": "latest",
        },
      };
    case "angular":
      return {
        dependencies: {
          "@angular/common": "latest",
          "@angular/core": "latest",
          "@angular/platform-browser": "latest",
        },
        devDependencies: {
          "@angular/cli": "latest",
          "@angular/compiler-cli": "latest",
          typescript: "latest",
        },
      };
    case "react-vite":
    default:
      return {
        dependencies: {
          react: "latest",
          "react-dom": "latest",
        },
        devDependencies: {
          vite: "latest",
          "@vitejs/plugin-react": "latest",
        },
      };
  }
}

function backendDependencies(
  framework: BackendFramework,
  adapter?: NestAdapter,
): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
} {
  switch (framework) {
    case "nestjs":
      return {
        dependencies: {
          "@nestjs/common": "latest",
          "@nestjs/core": "latest",
          [adapter === "fastify" ? "@nestjs/platform-fastify" : "@nestjs/platform-express"]:
            "latest",
          "reflect-metadata": "latest",
          rxjs: "latest",
        },
        devDependencies: {},
      };
    case "fastify":
      return {
        dependencies: {
          fastify: "latest",
        },
        devDependencies: {},
      };
    case "hono":
      return {
        dependencies: {
          "@hono/node-server": "latest",
          hono: "latest",
        },
        devDependencies: {},
      };
    case "koa":
      return {
        dependencies: {
          koa: "latest",
        },
        devDependencies: {},
      };
    case "express":
    default:
      return {
        dependencies: {
          cors: "latest",
          express: "latest",
        },
        devDependencies: {},
      };
  }
}

function collectDependencies(plan: ProjectPlan): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
} {
  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {};

  if (usesTypeScript(plan)) {
    addRecord(devDependencies, {
      "@types/node": "latest",
      tsx: "latest",
      typescript: "latest",
    });
  }

  if (plan.frontend) {
    const frontend = frontendDependencies(plan.frontend.framework);
    addRecord(dependencies, frontend.dependencies);
    addRecord(devDependencies, frontend.devDependencies);

    if (usesTypeScript(plan) && isReactLike(plan)) {
      addRecord(devDependencies, {
        "@types/react": "latest",
        "@types/react-dom": "latest",
      });
    }

    if (plan.frontend.styling === "tailwind-css") {
      if (["react-vite", "vue-vite", "svelte", "solidjs"].includes(plan.frontend.framework)) {
        addRecord(devDependencies, {
          "@tailwindcss/vite": "latest",
          tailwindcss: "latest",
        });
      } else {
        addRecord(devDependencies, {
          "@tailwindcss/postcss": "latest",
          postcss: "latest",
          tailwindcss: "latest",
        });
      }
    }

    if (plan.frontend.styling === "scss") {
      addRecord(devDependencies, {
        sass: "latest",
      });
    }

    if (plan.frontend.uiLibrary === "mui") {
      addRecord(dependencies, {
        "@emotion/react": "latest",
        "@emotion/styled": "latest",
        "@mui/material": "latest",
      });
    }

    if (plan.frontend.uiLibrary === "chakra-ui") {
      addRecord(dependencies, {
        "@chakra-ui/react": "latest",
      });
    }

    if (plan.frontend.uiLibrary === "ant-design") {
      addRecord(dependencies, {
        antd: "latest",
      });
    }

    if (plan.frontend.uiLibrary === "shadcn-ui" && isReactLike(plan)) {
      addRecord(dependencies, {
        clsx: "latest",
        "class-variance-authority": "latest",
        "tailwind-merge": "latest",
      });
    }

    if (plan.frontend.state === "zustand") {
      addRecord(dependencies, { zustand: "latest" });
    }

    if (plan.frontend.state === "redux") {
      addRecord(dependencies, {
        redux: "latest",
        "react-redux": "latest",
      });
    }

    if (plan.frontend.state === "redux-toolkit") {
      addRecord(dependencies, {
        "@reduxjs/toolkit": "latest",
        "react-redux": "latest",
      });
    }

    if (plan.frontend.state === "mobx") {
      addRecord(dependencies, {
        mobx: "latest",
        "mobx-react-lite": "latest",
      });
    }

    if (plan.frontend.state === "jotai") {
      addRecord(dependencies, {
        jotai: "latest",
      });
    }

    if (plan.frontend.state === "tanstack-store") {
      addRecord(dependencies, {
        "@tanstack/store": "latest",
      });
    }

    if (plan.frontend.dataFetching === "tanstack-query") {
      if (["nextjs", "react-vite", "remix"].includes(plan.frontend.framework)) {
        addRecord(dependencies, { "@tanstack/react-query": "latest" });
      }

      if (["nuxt", "vue-vite"].includes(plan.frontend.framework)) {
        addRecord(dependencies, { "@tanstack/vue-query": "latest" });
      }
    }

    if (plan.frontend.dataFetching === "swr" && isReactLike(plan)) {
      addRecord(dependencies, { swr: "latest" });
    }

    if (plan.frontend.dataFetching === "rtk-query") {
      addRecord(dependencies, {
        "@reduxjs/toolkit": "latest",
        "react-redux": "latest",
      });
    }

    if (plan.frontend.dataFetching === "apollo-client") {
      addRecord(dependencies, {
        "@apollo/client": "latest",
        graphql: "latest",
      });
    }
  }

  if (plan.backend) {
    const backend = backendDependencies(plan.backend.framework, plan.backend.adapter);
    addRecord(dependencies, backend.dependencies);
    addRecord(devDependencies, backend.devDependencies);

    if (usesTypeScript(plan)) {
      if (plan.backend.framework === "express") {
        addRecord(devDependencies, {
          "@types/cors": "latest",
          "@types/express": "latest",
        });
      }

      if (plan.backend.framework === "koa") {
        addRecord(devDependencies, {
          "@types/koa": "latest",
        });
      }
    }

    if (plan.backend.auth.includes("jwt")) {
      addRecord(dependencies, {
        bcryptjs: "latest",
        jsonwebtoken: "latest",
      });
    }

    if (plan.backend.auth.includes("oauth")) {
      addRecord(dependencies, {
        passport: "latest",
        "passport-oauth2": "latest",
      });
    }

    if (plan.backend.orm === "prisma") {
      addRecord(dependencies, { "@prisma/client": "latest" });
      addRecord(devDependencies, { prisma: "latest" });
    }

    if (plan.backend.orm === "drizzle") {
      addRecord(dependencies, { "drizzle-orm": "latest" });
      addRecord(devDependencies, { "drizzle-kit": "latest" });
    }

    if (plan.backend.database === "postgresql") {
      addRecord(dependencies, { pg: "latest" });
    }

    if (plan.backend.database === "mongodb") {
      addRecord(dependencies, { mongodb: "latest" });
    }

    if (plan.backend.redis) {
      addRecord(dependencies, { ioredis: "latest" });
    }

    if (plan.backend.swagger) {
      if (plan.backend.framework === "nestjs") {
        addRecord(dependencies, {
          "@nestjs/swagger": "latest",
        });
      }

      if (plan.backend.framework === "fastify") {
        addRecord(dependencies, {
          "@fastify/swagger": "latest",
          "@fastify/swagger-ui": "latest",
        });
      }

      if (plan.backend.framework === "express") {
        addRecord(dependencies, {
          "swagger-ui-express": "latest",
        });
      }
    }

    if (plan.backend.websockets) {
      addRecord(dependencies, { ws: "latest" });
    }
  }

  if (plan.intent === "cli-tool") {
    addRecord(devDependencies, {
      "@types/node": "latest",
      tsx: "latest",
      typescript: "latest",
    });
  }

  if (plan.intent === "chrome-extension") {
    addRecord(devDependencies, {
      vite: "latest",
      typescript: "latest",
      "@types/chrome": "latest",
    });

    if (plan.extension?.flavor === "react") {
      addRecord(dependencies, {
        react: "latest",
        "react-dom": "latest",
      });
      addRecord(devDependencies, {
        "@types/react": "latest",
        "@types/react-dom": "latest",
        "@vitejs/plugin-react": "latest",
      });
    } else {
      addRecord(devDependencies, {
        vite: "latest",
      });
    }

    if (plan.frontend?.styling === "tailwind-css") {
      addRecord(devDependencies, {
        "@tailwindcss/vite": "latest",
        tailwindcss: "latest",
      });
    }
  }

  if (plan.architecture === "microfrontend") {
    addRecord(devDependencies, {
      "@originjs/vite-plugin-federation": "latest",
      concurrently: "latest",
    });
  }

  if (plan.tooling.eslint) {
    addRecord(devDependencies, {
      eslint: "latest",
      "@eslint/js": "latest",
      "typescript-eslint": "latest",
    });
  }

  if (plan.tooling.prettier) {
    addRecord(devDependencies, {
      prettier: "latest",
    });
  }

  if (plan.tooling.husky) {
    addRecord(devDependencies, {
      husky: "latest",
    });
  }

  if (plan.tooling.commitlint) {
    addRecord(devDependencies, {
      "@commitlint/cli": "latest",
      "@commitlint/config-conventional": "latest",
    });
  }

  if (plan.testing.enabled) {
    if (plan.testing.runner === "vitest") {
      addRecord(devDependencies, {
        vitest: "latest",
      });

      if (plan.testing.environment === "jsdom") {
        addRecord(devDependencies, { jsdom: "latest" });
      }

      if (plan.testing.environment === "happy-dom") {
        addRecord(devDependencies, { "happy-dom": "latest" });
      }

      if (plan.frontend || plan.intent === "chrome-extension") {
        addRecord(devDependencies, {
          "@testing-library/react": "latest",
          "@testing-library/jest-dom": "latest",
        });
      }
    }

    if (plan.testing.runner === "jest") {
      addRecord(devDependencies, {
        jest: "latest",
      });

      if (usesTypeScript(plan)) {
        addRecord(devDependencies, {
          "ts-jest": "latest",
          "@types/jest": "latest",
        });
      }

      if (plan.testing.environment === "jsdom") {
        addRecord(devDependencies, {
          "jest-environment-jsdom": "latest",
        });
      }
    }

    if (plan.testing.runner === "playwright") {
      addRecord(devDependencies, {
        "@playwright/test": "latest",
      });
    }

    if (plan.testing.runner === "cypress") {
      addRecord(devDependencies, {
        cypress: "latest",
      });
    }
  }

  if (plan.intent === "fullstack-app" && plan.frontend?.framework !== "nextjs") {
    addRecord(devDependencies, {
      concurrently: "latest",
    });
  }

  return { dependencies, devDependencies };
}

function sortRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

function appendQualityScripts(
  plan: ProjectPlan,
  scripts: Record<string, string>,
): Record<string, string> {
  const checkSteps: string[] = [];

  if (plan.tooling.eslint) {
    scripts.lint = "eslint .";
    checkSteps.push("eslint .");
  }

  if (usesTypeScript(plan)) {
    scripts.typecheck = "tsc -p tsconfig.json --noEmit";
    checkSteps.push("tsc -p tsconfig.json --noEmit");
  }

  if (plan.tooling.prettier) {
    scripts.format = "prettier --check .";
    checkSteps.push("prettier --check .");
  }

  if (scripts.build) {
    checkSteps.push(scripts.build);
  }

  if (plan.testing.enabled && (plan.testing.runner === "vitest" || plan.testing.runner === "jest")) {
    checkSteps.push(scripts.test ?? "");
  }

  scripts.check =
    checkSteps.length > 0
      ? checkSteps.filter(Boolean).join(" && ")
      : "node -e \"console.log('No additional validation configured')\"";

  return scripts;
}

function singlePackageScripts(plan: ProjectPlan): Record<string, string> {
  const scripts: Record<string, string> = {};

  if (plan.tooling.husky) {
    scripts.prepare = "husky";
  }

  switch (plan.intent) {
    case "landing-page":
    case "frontend-app":
      switch (plan.frontend?.framework) {
        case "nextjs":
          addRecord(scripts, {
            dev: "next dev",
            build: "next build",
            start: "next start",
          });
          break;
        case "astro":
          addRecord(scripts, {
            dev: "astro dev",
            build: "astro build",
            preview: "astro preview",
          });
          break;
        case "nuxt":
          addRecord(scripts, {
            dev: "nuxt dev",
            build: "nuxt build",
            preview: "nuxt preview",
          });
          break;
        case "remix":
          addRecord(scripts, {
            dev: "remix vite:dev",
            build: "remix vite:build",
          });
          break;
        case "angular":
          addRecord(scripts, {
            dev: "ng serve",
            build: "ng build",
          });
          break;
        default:
          addRecord(scripts, {
            dev: "vite",
            build: "vite build",
            preview: "vite preview",
          });
          break;
      }
      break;
    case "backend-api":
      addRecord(
        scripts,
        usesTypeScript(plan)
          ? {
              dev: "tsx watch src/server.ts",
              build: "tsc -p tsconfig.json",
              start: "node dist/src/server.js",
            }
          : {
              dev: "node --watch src/server.js",
              build: "node --eval \"console.log('JavaScript API does not require compilation')\"",
              start: "node src/server.js",
            },
      );
      break;
    case "fullstack-app":
      if (plan.frontend?.framework === "nextjs") {
        addRecord(scripts, {
          dev: "next dev",
          build: "next build",
          start: "next start",
        });
      } else {
        addRecord(scripts, {
          dev: `concurrently -n web,api "${packageManagerRunCommand(plan.packageManager, "dev:web")}" "${packageManagerRunCommand(plan.packageManager, "dev:api")}"`,
          "dev:web": "vite",
          "dev:api": backendUsesTypeScript(plan)
            ? "tsx watch src/server.ts"
            : "node --watch src/server.js",
          build: `${packageManagerRunCommand(plan.packageManager, "build:web")} && ${packageManagerRunCommand(plan.packageManager, "build:api")}`,
          "build:web": "vite build",
          "build:api": backendUsesTypeScript(plan)
            ? "tsc -p tsconfig.server.json"
            : "echo \"JavaScript API does not require compilation\"",
          "start:api": backendUsesTypeScript(plan)
            ? "node dist-api/src/server.js"
            : "node src/server.js",
        });
      }
      break;
    case "chrome-extension":
      addRecord(scripts, {
        dev: "vite",
        build: "vite build",
      });
      break;
    case "cli-tool":
      addRecord(scripts, {
        dev: "tsx src/index.ts",
        build: "tsc -p tsconfig.json",
        start: "node dist/src/index.js",
      });
      break;
    default:
      break;
  }

  if (plan.testing.enabled) {
    switch (plan.testing.runner) {
      case "vitest":
        addRecord(scripts, {
          test: "vitest run",
          "test:watch": "vitest",
        });
        break;
      case "jest":
        addRecord(scripts, {
          test: "jest --runInBand",
          "test:watch": "jest --watch",
        });
        break;
      case "playwright":
        addRecord(scripts, {
          "test:e2e": "playwright test",
        });
        break;
      case "cypress":
        addRecord(scripts, {
          "test:e2e": "cypress run",
        });
        break;
      default:
        break;
    }
  }

  return appendQualityScripts(plan, scripts);
}

function microfrontendHostScripts(plan: ProjectPlan, port: number): Record<string, string> {
  const scripts = singlePackageScripts(plan);
  scripts.dev = `vite --host 127.0.0.1 --port ${port} --strictPort`;
  scripts.preview = `vite preview --host 127.0.0.1 --port ${port} --strictPort`;
  return scripts;
}

function microfrontendRemoteScripts(plan: ProjectPlan, port: number): Record<string, string> {
  const scripts = singlePackageScripts(plan);
  scripts["build:watch"] = "vite build --watch";
  scripts.dev =
    `concurrently -k -n build,preview "vite build --watch" "vite preview --host 127.0.0.1 --port ${port} --strictPort"`;
  scripts.preview = `vite preview --host 127.0.0.1 --port ${port} --strictPort`;
  return scripts;
}

function singlePackageJson(
  plan: ProjectPlan,
  packageManagerMetadata: PackageManagerMetadata,
): GeneratedFile {
  const { dependencies, devDependencies } = collectDependencies(plan);
  const data: PackageJsonShape = {
    name: plan.projectName,
    version: generatedProjectVersion(),
    private: true,
    type: "module",
    packageManager: packageManagerField(packageManagerMetadata),
    pnpm: pnpmPackageConfig(plan),
    scripts: sortRecord(singlePackageScripts(plan)),
    engines: {
      node: generatedProjectNodeEngine(plan),
    },
    dependencies: sortRecord(dependencies),
    devDependencies: sortRecord(devDependencies),
  };

  return makeFile("package.json", stringifyJson(data));
}

function styleFileContent(plan: ProjectPlan): string {
  if (plan.frontend?.styling === "tailwind-css") {
    return ['@import "tailwindcss";', ""].join("\n");
  }

  if (plan.frontend?.styling === "scss") {
    return [
      "$surface: #f3f0ea;",
      "$ink: #112233;",
      "",
      "body {",
      "  margin: 0;",
      "  background: linear-gradient(180deg, #f8f5ef 0%, $surface 100%);",
      "  color: $ink;",
      "  font-family: Georgia, serif;",
      "}",
      "",
    ].join("\n");
  }

  return [
    ":root {",
    "  color-scheme: light;",
    "  font-family: Georgia, serif;",
    "  color: #112233;",
    "  background: linear-gradient(180deg, #f8f5ef 0%, #efe9dd 100%);",
    "}",
    "",
    "body {",
    "  margin: 0;",
    "}",
    "",
  ].join("\n");
}

function tailwindSupportFiles(plan: ProjectPlan): GeneratedFile[] {
  if (plan.frontend?.styling !== "tailwind-css") {
    return [];
  }

  if (["react-vite", "vue-vite", "svelte", "solidjs"].includes(plan.frontend.framework)) {
    return [];
  }

  return [
    makeFile(
      "postcss.config.mjs",
      [
        "export default {",
        "  plugins: {",
        '    "@tailwindcss/postcss": {},',
        "  },",
        "};",
        "",
      ].join("\n"),
    ),
  ];
}

function viteTailwindPluginImportLines(plan: ProjectPlan): string[] {
  return plan.frontend?.styling === "tailwind-css"
    ? ['import tailwindcss from "@tailwindcss/vite";']
    : [];
}

function vitePluginExpression(plugins: string[], indent = "  "): string {
  return `${indent}plugins: [${plugins.join(", ")}],`;
}

function reactAppSource(plan: ProjectPlan, context?: FrontendSurfaceContext): GeneratedFile[] {
  const frontend = plan.frontend;
  const styleImport =
    frontend?.styling === "scss" ? "./styles.scss" : "./styles.css";
  const surface = frontendSurfaceDetails(plan, context);
  const pluginLines = ["react()", ...(frontend?.styling === "tailwind-css" ? ["tailwindcss()"] : [])];

  const files: GeneratedFile[] = [
    viteEnvTypesFile(),
    makeFile(
      "index.html",
      [
        "<!doctype html>",
        "<html lang=\"en\">",
        "  <head>",
        "    <meta charset=\"UTF-8\" />",
        "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
        `    <title>${toTitleCase(plan.projectName)}</title>`,
        "  </head>",
        "  <body>",
        "    <div id=\"root\"></div>",
        "    <script type=\"module\" src=\"/src/main.tsx\"></script>",
        "  </body>",
        "</html>",
        "",
      ].join("\n"),
    ),
    makeFile(
      "vite.config.ts",
      [
        "import { defineConfig } from \"vite\";",
        "import react from \"@vitejs/plugin-react\";",
        ...viteTailwindPluginImportLines(plan),
        "",
        "export default defineConfig({",
        vitePluginExpression(pluginLines),
        "});",
        "",
      ].join("\n"),
    ),
    makeFile(
      "src/main.tsx",
      [
        "import React from \"react\";",
        "import ReactDOM from \"react-dom/client\";",
        "import App from \"./App\";",
        `import "${styleImport}";`,
        "",
        "ReactDOM.createRoot(document.getElementById(\"root\")!).render(",
        "  <React.StrictMode>",
        "    <App />",
        "  </React.StrictMode>,",
        ");",
        "",
      ].join("\n"),
    ),
    makeFile(
      "src/App.tsx",
      [
        `const badge = ${JSON.stringify(surface.badge)};`,
        `const heading = ${JSON.stringify(surface.heading)};`,
        `const lead = ${JSON.stringify(surface.lead)};`,
        `const details = ${JSON.stringify(surface.entries, null, 2)};`,
        `const generatedWith = ${JSON.stringify(generatedWithText())};`,
        "",
        "export default function App() {",
        "  return (",
        "    <main style={{ minHeight: \"100vh\", padding: \"3rem 1.5rem\", background: \"linear-gradient(180deg, #f8f5ef 0%, #efe9dd 100%)\", color: \"#112233\" }}>",
        "      <section style={{ maxWidth: 960, margin: \"0 auto\", padding: 32, borderRadius: 24, background: \"rgba(255, 252, 247, 0.92)\", border: \"1px solid #e4d8c6\", boxShadow: \"0 24px 80px rgba(17, 34, 51, 0.08)\" }}>",
        "        <p style={{ letterSpacing: \"0.18em\", textTransform: \"uppercase\", fontSize: 12, fontWeight: 700, color: \"#7d5a32\" }}>{badge}</p>",
        "        <h1 style={{ margin: \"0.35rem 0 0\", fontSize: \"clamp(2.4rem, 5vw, 4rem)\" }}>{heading}</h1>",
        "        <p style={{ marginTop: 16, maxWidth: 720, fontSize: 18, lineHeight: 1.7, color: \"#3a4856\" }}>{lead}</p>",
        "        <dl style={{ marginTop: 28, display: \"grid\", gridTemplateColumns: \"repeat(auto-fit, minmax(220px, 1fr))\", gap: 16 }}>",
        "          {details.map((detail) => (",
        "            <div key={detail.label} style={{ margin: 0, padding: 18, borderRadius: 18, border: \"1px solid #eadfcd\", background: \"#fffaf3\" }}>",
        "              <dt style={{ fontSize: 12, textTransform: \"uppercase\", letterSpacing: \"0.12em\", color: \"#7b6547\" }}>{detail.label}</dt>",
        "              <dd style={{ margin: \"0.6rem 0 0\", fontSize: 18, fontWeight: 600, color: \"#15283b\" }}>{detail.value}</dd>",
        "            </div>",
        "          ))}",
        "        </dl>",
        "        <p style={{ marginTop: 24, fontSize: 14, color: \"#6d5a45\" }}>{generatedWith}</p>",
        "      </section>",
        "    </main>",
        "  );",
        "}",
        "",
      ].join("\n"),
    ),
    makeFile(
      frontend?.styling === "scss" ? "src/styles.scss" : "src/styles.css",
      styleFileContent(plan),
    ),
  ];

  if (frontend?.state && frontend.state !== "none") {
    files.push(
      makeFile(
        "src/lib/state.ts",
        [
          "export const stateNotes = {",
          `  provider: "${frontend.state}",`,
          "  message: \"Wire your real state layer into this module as features appear.\",",
          "};",
          "",
        ].join("\n"),
      ),
    );
  }

  if (frontend?.dataFetching && frontend.dataFetching !== "none") {
    files.push(
      makeFile(
        "src/lib/data.ts",
        [
          "export async function loadHealthcheck(): Promise<{ ok: boolean }> {",
          "  return { ok: true };",
          "}",
          "",
        ].join("\n"),
      ),
    );
  }

  files.push(...tailwindSupportFiles(plan));

  return files;
}

function nextJsSource(plan: ProjectPlan, context?: FrontendSurfaceContext): GeneratedFile[] {
  const surface = frontendSurfaceDetails(plan, context);
  return [
    makeFile(
      "next-env.d.ts",
      [
        "/// <reference types=\"next\" />",
        "/// <reference types=\"next/image-types/global\" />",
        "",
      ].join("\n"),
    ),
    makeFile(
      "next.config.ts",
      [
        "const nextConfig = {",
        "  reactStrictMode: true,",
        "};",
        "",
        "export default nextConfig;",
        "",
      ].join("\n"),
    ),
    makeFile(
      "app/layout.tsx",
      [
        "import \"./globals.css\";",
        "import type { ReactNode } from \"react\";",
        "",
        "export const metadata = {",
        `  title: "${toTitleCase(plan.projectName)}",`,
        `  description: "${plan.metadata.description}",`,
        "};",
        "",
        "export default function RootLayout({ children }: { children: ReactNode }) {",
        "  return (",
        "    <html lang=\"en\">",
        "      <body>{children}</body>",
        "    </html>",
        "  );",
        "}",
        "",
      ].join("\n"),
    ),
    makeFile(
      "app/page.tsx",
      [
        `const details = ${JSON.stringify(surface.entries, null, 2)};`,
        `const generatedWith = ${JSON.stringify(generatedWithText())};`,
        "",
        "export default function HomePage() {",
        "  return (",
        "    <main style={{ minHeight: \"100vh\", padding: \"3rem 1.5rem\", background: \"linear-gradient(180deg, #f8f5ef 0%, #efe9dd 100%)\", color: \"#112233\" }}>",
        "      <section style={{ maxWidth: 960, margin: \"0 auto\", padding: 32, borderRadius: 24, background: \"rgba(255, 252, 247, 0.92)\", border: \"1px solid #e4d8c6\" }}>",
        `        <p style={{ textTransform: "uppercase", letterSpacing: "0.18em", fontSize: 12, color: "#7d5a32" }}>${surface.badge}</p>`,
        `        <h1 style={{ marginTop: 8, fontSize: "clamp(2.4rem, 5vw, 4rem)" }}>${surface.heading}</h1>`,
        `        <p style={{ marginTop: 16, maxWidth: 720, fontSize: 18, lineHeight: 1.7, color: "#3a4856" }}>${surface.lead}</p>`,
        "        <dl style={{ marginTop: 28, display: \"grid\", gridTemplateColumns: \"repeat(auto-fit, minmax(220px, 1fr))\", gap: 16 }}>",
        "          {details.map((detail) => (",
        "            <div key={detail.label} style={{ padding: 18, borderRadius: 18, border: \"1px solid #eadfcd\", background: \"#fffaf3\" }}>",
        "              <dt style={{ fontSize: 12, textTransform: \"uppercase\", letterSpacing: \"0.12em\", color: \"#7b6547\" }}>{detail.label}</dt>",
        "              <dd style={{ margin: \"0.6rem 0 0\", fontSize: 18, fontWeight: 600, color: \"#15283b\" }}>{detail.value}</dd>",
        "            </div>",
        "          ))}",
        "        </dl>",
        "        <p style={{ marginTop: 24, fontSize: 14, color: \"#6d5a45\" }}>{generatedWith}</p>",
        "      </section>",
        "    </main>",
        "  );",
        "}",
        "",
      ].join("\n"),
    ),
    makeFile("app/globals.css", styleFileContent(plan)),
    ...tailwindSupportFiles(plan),
  ];
}

function astroSource(plan: ProjectPlan, context?: FrontendSurfaceContext): GeneratedFile[] {
  const surface = frontendSurfaceDetails(plan, context);
  return [
    makeFile(
      "astro.config.mjs",
      [
        "import { defineConfig } from \"astro/config\";",
        "",
        "export default defineConfig({});",
        "",
      ].join("\n"),
    ),
    makeFile(
      "src/pages/index.astro",
      [
        "---",
        `const title = ${JSON.stringify(surface.heading)};`,
        `const badge = ${JSON.stringify(surface.badge)};`,
        `const lead = ${JSON.stringify(surface.lead)};`,
        `const details = ${JSON.stringify(surface.entries, null, 2)};`,
        `const generatedWith = ${JSON.stringify(generatedWithText())};`,
        "---",
        "",
        "<html lang=\"en\">",
        "  <head>",
        "    <meta charset=\"utf-8\" />",
        "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
        "    <title>{title}</title>",
        "    <style>",
        "      body { margin: 0; font-family: Georgia, serif; background: linear-gradient(180deg, #f8f5ef 0%, #efe9dd 100%); color: #112233; }",
        "      .shell { max-width: 960px; margin: 0 auto; padding: 3rem 1.5rem; }",
        "      .panel { padding: 2rem; border-radius: 24px; background: rgba(255, 252, 247, 0.92); border: 1px solid #e4d8c6; }",
        "      .eyebrow { text-transform: uppercase; letter-spacing: 0.18em; font-size: 12px; color: #7d5a32; }",
        "      .lede { max-width: 720px; font-size: 18px; line-height: 1.7; color: #3a4856; }",
        "      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 28px; }",
        "      .card { padding: 18px; border-radius: 18px; border: 1px solid #eadfcd; background: #fffaf3; }",
        "      dt { font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #7b6547; }",
        "      dd { margin: 0.6rem 0 0; font-size: 18px; font-weight: 600; color: #15283b; }",
        "      .signature { margin-top: 24px; font-size: 14px; color: #6d5a45; }",
        "    </style>",
        "  </head>",
        "  <body>",
        "    <main class=\"shell\">",
        "      <section class=\"panel\">",
        "        <p class=\"eyebrow\">{badge}</p>",
        "        <h1>{title}</h1>",
        "        <p class=\"lede\">{lead}</p>",
        "        <dl class=\"grid\">",
        "          {details.map((detail) => (",
        "            <div class=\"card\">",
        "              <dt>{detail.label}</dt>",
        "              <dd>{detail.value}</dd>",
        "            </div>",
        "          ))}",
        "        </dl>",
        "        <p class=\"signature\">{generatedWith}</p>",
        "      </section>",
        "    </main>",
        "  </body>",
        "</html>",
        "",
      ].join("\n"),
    ),
    ...tailwindSupportFiles(plan),
  ];
}

function vueSource(plan: ProjectPlan, context?: FrontendSurfaceContext): GeneratedFile[] {
  const surface = frontendSurfaceDetails(plan, context);
  const pluginLines = ["vue()", ...(plan.frontend?.styling === "tailwind-css" ? ["tailwindcss()"] : [])];

  return [
    viteEnvTypesFile(),
    makeFile(
      "index.html",
      [
        "<!doctype html>",
        "<html lang=\"en\">",
        "  <head>",
        "    <meta charset=\"UTF-8\" />",
        "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
        `    <title>${toTitleCase(plan.projectName)}</title>`,
        "  </head>",
        "  <body>",
        "    <div id=\"app\"></div>",
        "    <script type=\"module\" src=\"/src/main.ts\"></script>",
        "  </body>",
        "</html>",
        "",
      ].join("\n"),
    ),
    makeFile(
      "vite.config.ts",
      [
        "import { defineConfig } from \"vite\";",
        "import vue from \"@vitejs/plugin-vue\";",
        ...viteTailwindPluginImportLines(plan),
        "",
        "export default defineConfig({",
        vitePluginExpression(pluginLines),
        "});",
        "",
      ].join("\n"),
    ),
    makeFile(
      "src/main.ts",
      [
        "import { createApp } from \"vue\";",
        "import App from \"./App.vue\";",
        "",
        "createApp(App).mount(\"#app\");",
        "",
      ].join("\n"),
    ),
    makeFile(
      "src/App.vue",
      [
        "<template>",
        "  <main class=\"shell\">",
        "    <section class=\"panel\">",
        `      <p class="eyebrow">${surface.badge}</p>`,
        `      <h1>${surface.heading}</h1>`,
        `      <p class="lede">${surface.lead}</p>`,
        "      <dl class=\"grid\">",
        "        <div v-for=\"detail in details\" :key=\"detail.label\" class=\"card\">",
        "          <dt>{{ detail.label }}</dt>",
        "          <dd>{{ detail.value }}</dd>",
        "        </div>",
        "      </dl>",
        `      <p class="signature">${generatedWithText()}</p>`,
        "    </section>",
        "  </main>",
        "</template>",
        "",
        "<script setup lang=\"ts\">",
        `const details = ${JSON.stringify(surface.entries, null, 2)};`,
        "</script>",
        "",
        "<style scoped>",
        ".shell { min-height: 100vh; padding: 3rem 1.5rem; background: linear-gradient(180deg, #f8f5ef 0%, #efe9dd 100%); color: #112233; }",
        ".panel { max-width: 960px; margin: 0 auto; padding: 2rem; border-radius: 24px; background: rgba(255, 252, 247, 0.92); border: 1px solid #e4d8c6; }",
        ".eyebrow { text-transform: uppercase; letter-spacing: 0.18em; font-size: 12px; color: #7d5a32; }",
        ".lede { max-width: 720px; font-size: 18px; line-height: 1.7; color: #3a4856; }",
        ".grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 28px; }",
        ".card { padding: 18px; border-radius: 18px; border: 1px solid #eadfcd; background: #fffaf3; }",
        "dt { font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #7b6547; }",
        "dd { margin: 0.6rem 0 0; font-size: 18px; font-weight: 600; color: #15283b; }",
        ".signature { margin-top: 24px; font-size: 14px; color: #6d5a45; }",
        "</style>",
        "",
      ].join("\n"),
    ),
    ...tailwindSupportFiles(plan),
  ];
}

function nuxtSource(plan: ProjectPlan, context?: FrontendSurfaceContext): GeneratedFile[] {
  const surface = frontendSurfaceDetails(plan, context);
  return [
    makeFile(
      "nuxt.config.ts",
      [
        "export default defineNuxtConfig({",
        "  devtools: { enabled: true },",
        "});",
        "",
      ].join("\n"),
    ),
    makeFile(
      "app.vue",
      [
        "<template>",
        "  <main class=\"shell\">",
        "    <section class=\"panel\">",
        `      <p class="eyebrow">${surface.badge}</p>`,
        `      <h1>${surface.heading}</h1>`,
        `      <p class="lede">${surface.lead}</p>`,
        "      <dl class=\"grid\">",
        "        <div v-for=\"detail in details\" :key=\"detail.label\" class=\"card\">",
        "          <dt>{{ detail.label }}</dt>",
        "          <dd>{{ detail.value }}</dd>",
        "        </div>",
        "      </dl>",
        `      <p class="signature">${generatedWithText()}</p>`,
        "    </section>",
        "  </main>",
        "</template>",
        "",
        "<script setup lang=\"ts\">",
        `const details = ${JSON.stringify(surface.entries, null, 2)};`,
        "</script>",
        "",
        "<style scoped>",
        ".shell { min-height: 100vh; padding: 3rem 1.5rem; background: linear-gradient(180deg, #f8f5ef 0%, #efe9dd 100%); color: #112233; }",
        ".panel { max-width: 960px; margin: 0 auto; padding: 2rem; border-radius: 24px; background: rgba(255, 252, 247, 0.92); border: 1px solid #e4d8c6; }",
        ".eyebrow { text-transform: uppercase; letter-spacing: 0.18em; font-size: 12px; color: #7d5a32; }",
        ".lede { max-width: 720px; font-size: 18px; line-height: 1.7; color: #3a4856; }",
        ".grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 28px; }",
        ".card { padding: 18px; border-radius: 18px; border: 1px solid #eadfcd; background: #fffaf3; }",
        "dt { font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #7b6547; }",
        "dd { margin: 0.6rem 0 0; font-size: 18px; font-weight: 600; color: #15283b; }",
        ".signature { margin-top: 24px; font-size: 14px; color: #6d5a45; }",
        "</style>",
        "",
      ].join("\n"),
    ),
    ...tailwindSupportFiles(plan),
  ];
}

function svelteSource(plan: ProjectPlan, context?: FrontendSurfaceContext): GeneratedFile[] {
  const surface = frontendSurfaceDetails(plan, context);
  const pluginLines = ["svelte()", ...(plan.frontend?.styling === "tailwind-css" ? ["tailwindcss()"] : [])];

  return [
    viteEnvTypesFile(),
    makeFile(
      "index.html",
      [
        "<!doctype html>",
        "<html lang=\"en\">",
        "  <head>",
        "    <meta charset=\"UTF-8\" />",
        "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
        `    <title>${toTitleCase(plan.projectName)}</title>`,
        "  </head>",
        "  <body>",
        "    <div id=\"app\"></div>",
        "    <script type=\"module\" src=\"/src/main.ts\"></script>",
        "  </body>",
        "</html>",
        "",
      ].join("\n"),
    ),
    makeFile(
      "vite.config.ts",
      [
        "import { defineConfig } from \"vite\";",
        "import { svelte } from \"@sveltejs/vite-plugin-svelte\";",
        ...viteTailwindPluginImportLines(plan),
        "",
        "export default defineConfig({",
        vitePluginExpression(pluginLines),
        "});",
        "",
      ].join("\n"),
    ),
    makeFile(
      "src/main.ts",
      [
        "import App from \"./App.svelte\";",
        "",
        "const app = new App({",
        "  target: document.getElementById(\"app\")!,",
        "});",
        "",
        "export default app;",
        "",
      ].join("\n"),
    ),
    makeFile(
      "src/App.svelte",
      [
        "<script lang=\"ts\">",
        `  const details = ${JSON.stringify(surface.entries, null, 2)};`,
        "</script>",
        "",
        `<svelte:head><title>${surface.heading}</title></svelte:head>`,
        "",
        `<main style="min-height: 100vh; padding: 3rem 1.5rem; background: linear-gradient(180deg, #f8f5ef 0%, #efe9dd 100%); color: #112233;">`,
        `  <section style="max-width: 960px; margin: 0 auto; padding: 2rem; border-radius: 24px; background: rgba(255, 252, 247, 0.92); border: 1px solid #e4d8c6;">`,
        `    <p style="text-transform: uppercase; letter-spacing: 0.18em; font-size: 12px; color: #7d5a32;">${surface.badge}</p>`,
        `    <h1 style="margin-top: 0.35rem; font-size: clamp(2.4rem, 5vw, 4rem);">${surface.heading}</h1>`,
        `    <p style="max-width: 720px; font-size: 18px; line-height: 1.7; color: #3a4856;">${surface.lead}</p>`,
        "    <dl style=\"display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 28px;\">",
        "      {#each details as detail}",
        "        <div style=\"padding: 18px; border-radius: 18px; border: 1px solid #eadfcd; background: #fffaf3;\">",
        "          <dt style=\"font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #7b6547;\">{detail.label}</dt>",
        "          <dd style=\"margin: 0.6rem 0 0; font-size: 18px; font-weight: 600; color: #15283b;\">{detail.value}</dd>",
        "        </div>",
        "      {/each}",
        "    </dl>",
        `    <p style="margin-top: 24px; font-size: 14px; color: #6d5a45;">${generatedWithText()}</p>`,
        "  </section>",
        "</main>",
        "",
      ].join("\n"),
    ),
    ...tailwindSupportFiles(plan),
  ];
}

function svelteKitSource(plan: ProjectPlan, context?: FrontendSurfaceContext): GeneratedFile[] {
  const surface = frontendSurfaceDetails(plan, context);
  return [
    makeFile(
      "svelte.config.js",
      [
        "export default {",
        "  kit: {},",
        "};",
        "",
      ].join("\n"),
    ),
    makeFile(
      "src/routes/+page.svelte",
      [
        "<script lang=\"ts\">",
        `  const details = ${JSON.stringify(surface.entries, null, 2)};`,
        "</script>",
        "",
        `<svelte:head><title>${surface.heading}</title></svelte:head>`,
        "",
        `<main style="min-height: 100vh; padding: 3rem 1.5rem; background: linear-gradient(180deg, #f8f5ef 0%, #efe9dd 100%); color: #112233;">`,
        `  <section style="max-width: 960px; margin: 0 auto; padding: 2rem; border-radius: 24px; background: rgba(255, 252, 247, 0.92); border: 1px solid #e4d8c6;">`,
        `    <p style="text-transform: uppercase; letter-spacing: 0.18em; font-size: 12px; color: #7d5a32;">${surface.badge}</p>`,
        `    <h1 style="margin-top: 0.35rem; font-size: clamp(2.4rem, 5vw, 4rem);">${surface.heading}</h1>`,
        `    <p style="max-width: 720px; font-size: 18px; line-height: 1.7; color: #3a4856;">${surface.lead}</p>`,
        "    <dl style=\"display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 28px;\">",
        "      {#each details as detail}",
        "        <div style=\"padding: 18px; border-radius: 18px; border: 1px solid #eadfcd; background: #fffaf3;\">",
        "          <dt style=\"font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #7b6547;\">{detail.label}</dt>",
        "          <dd style=\"margin: 0.6rem 0 0; font-size: 18px; font-weight: 600; color: #15283b;\">{detail.value}</dd>",
        "        </div>",
        "      {/each}",
        "    </dl>",
        `    <p style="margin-top: 24px; font-size: 14px; color: #6d5a45;">${generatedWithText()}</p>`,
        "  </section>",
        "</main>",
        "",
      ].join("\n"),
    ),
    ...tailwindSupportFiles(plan),
  ];
}

function solidSource(plan: ProjectPlan, context?: FrontendSurfaceContext): GeneratedFile[] {
  const surface = frontendSurfaceDetails(plan, context);
  const pluginLines = ["solid()", ...(plan.frontend?.styling === "tailwind-css" ? ["tailwindcss()"] : [])];

  return [
    viteEnvTypesFile(),
    makeFile(
      "index.html",
      [
        "<!doctype html>",
        "<html lang=\"en\">",
        "  <head>",
        "    <meta charset=\"UTF-8\" />",
        "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
        `    <title>${toTitleCase(plan.projectName)}</title>`,
        "  </head>",
        "  <body>",
        "    <div id=\"root\"></div>",
        "    <script type=\"module\" src=\"/src/index.tsx\"></script>",
        "  </body>",
        "</html>",
        "",
      ].join("\n"),
    ),
    makeFile(
      "vite.config.ts",
      [
        "import { defineConfig } from \"vite\";",
        "import solid from \"vite-plugin-solid\";",
        ...viteTailwindPluginImportLines(plan),
        "",
        "export default defineConfig({",
        vitePluginExpression(pluginLines),
        "});",
        "",
      ].join("\n"),
    ),
    makeFile(
      "src/index.tsx",
      [
        "import { render } from \"solid-js/web\";",
        "import App from \"./App\";",
        "",
        "render(() => <App />, document.getElementById(\"root\")!);",
        "",
      ].join("\n"),
    ),
    makeFile(
      "src/App.tsx",
      [
        `const details = ${JSON.stringify(surface.entries, null, 2)};`,
        `const generatedWith = ${JSON.stringify(generatedWithText())};`,
        "",
        "export default function App() {",
        "  return (",
        "    <main style={{ minHeight: \"100vh\", padding: \"3rem 1.5rem\", background: \"linear-gradient(180deg, #f8f5ef 0%, #efe9dd 100%)\", color: \"#112233\" }}>",
        "      <section style={{ maxWidth: \"960px\", margin: \"0 auto\", padding: \"2rem\", borderRadius: \"24px\", background: \"rgba(255, 252, 247, 0.92)\", border: \"1px solid #e4d8c6\" }}>",
        `        <p style={{ textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "12px", color: "#7d5a32" }}>${surface.badge}</p>`,
        `        <h1 style={{ marginTop: "0.35rem", fontSize: "clamp(2.4rem, 5vw, 4rem)" }}>${surface.heading}</h1>`,
        `        <p style={{ maxWidth: "720px", fontSize: "18px", lineHeight: 1.7, color: "#3a4856" }}>${surface.lead}</p>`,
        "        <dl style={{ display: \"grid\", gridTemplateColumns: \"repeat(auto-fit, minmax(220px, 1fr))\", gap: \"16px\", marginTop: \"28px\" }}>",
        "          {details.map((detail) => (",
        "            <div style={{ padding: \"18px\", borderRadius: \"18px\", border: \"1px solid #eadfcd\", background: \"#fffaf3\" }}>",
        "              <dt style={{ fontSize: \"12px\", textTransform: \"uppercase\", letterSpacing: \"0.12em\", color: \"#7b6547\" }}>{detail.label}</dt>",
        "              <dd style={{ margin: \"0.6rem 0 0\", fontSize: \"18px\", fontWeight: 600, color: \"#15283b\" }}>{detail.value}</dd>",
        "            </div>",
        "          ))}",
        "        </dl>",
        "        <p style={{ marginTop: \"24px\", fontSize: \"14px\", color: \"#6d5a45\" }}>{generatedWith}</p>",
        "      </section>",
        "    </main>",
        "  );",
        "}",
        "",
      ].join("\n"),
    ),
    ...tailwindSupportFiles(plan),
  ];
}

function angularSource(plan: ProjectPlan, context?: FrontendSurfaceContext): GeneratedFile[] {
  const surface = frontendSurfaceDetails(plan, context);
  return [
    makeFile(
      "src/main.ts",
      [
        "import { bootstrapApplication } from \"@angular/platform-browser\";",
        "import { Component } from \"@angular/core\";",
        "",
        `const details = ${JSON.stringify(surface.entries, null, 2)};`,
        "",
        "@Component({",
        "  selector: \"app-root\",",
        "  standalone: true,",
        `  template: \`
    <main style="min-height:100vh;padding:3rem 1.5rem;background:linear-gradient(180deg,#f8f5ef 0%,#efe9dd 100%);color:#112233">
      <section style="max-width:960px;margin:0 auto;padding:2rem;border-radius:24px;background:rgba(255,252,247,0.92);border:1px solid #e4d8c6">
        <p style="text-transform:uppercase;letter-spacing:0.18em;font-size:12px;color:#7d5a32">${surface.badge}</p>
        <h1 style="margin-top:0.35rem;font-size:clamp(2.4rem,5vw,4rem)">${surface.heading}</h1>
        <p style="max-width:720px;font-size:18px;line-height:1.7;color:#3a4856">${surface.lead}</p>
        <dl style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:28px">
          <div *ngFor="let detail of details" style="padding:18px;border-radius:18px;border:1px solid #eadfcd;background:#fffaf3">
            <dt style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#7b6547">{{ detail.label }}</dt>
            <dd style="margin:0.6rem 0 0;font-size:18px;font-weight:600;color:#15283b">{{ detail.value }}</dd>
          </div>
        </dl>
        <p style="margin-top:24px;font-size:14px;color:#6d5a45">${generatedWithText()}</p>
      </section>
    </main>\`,`,
        "  styles: [],",
        "})",
        "class AppComponent {",
        "  details = details;",
        "}",
        "",
        "bootstrapApplication(AppComponent);",
        "",
      ].join("\n"),
    ),
    makeFile(
      "docs/framework-notes.md",
      [
        "# Angular Notes",
        "",
        "This scaffold creates the application shell and dependencies, but you may want to run Angular CLI generators next for a full workspace config.",
        "",
      ].join("\n"),
    ),
  ];
}

function remixSource(plan: ProjectPlan, context?: FrontendSurfaceContext): GeneratedFile[] {
  const surface = frontendSurfaceDetails(plan, context);
  return [
    makeFile(
      "app/root.tsx",
      [
        "import { Links, Meta, Outlet, Scripts, ScrollRestoration } from \"@remix-run/react\";",
        "",
        "export default function App() {",
        "  return (",
        "    <html lang=\"en\">",
        "      <head>",
        "        <Meta />",
        "        <Links />",
        "      </head>",
        "      <body>",
        "        <Outlet />",
        "        <ScrollRestoration />",
        "        <Scripts />",
        "      </body>",
        "    </html>",
        "  );",
        "}",
        "",
      ].join("\n"),
    ),
    makeFile(
      "app/routes/_index.tsx",
      [
        `const details = ${JSON.stringify(surface.entries, null, 2)};`,
        `const generatedWith = ${JSON.stringify(generatedWithText())};`,
        "",
        "export default function IndexRoute() {",
        "  return (",
        "    <main style={{ minHeight: \"100vh\", padding: \"3rem 1.5rem\", background: \"linear-gradient(180deg, #f8f5ef 0%, #efe9dd 100%)\", color: \"#112233\" }}>",
        "      <section style={{ maxWidth: 960, margin: \"0 auto\", padding: 32, borderRadius: 24, background: \"rgba(255, 252, 247, 0.92)\", border: \"1px solid #e4d8c6\" }}>",
        `        <p style={{ textTransform: "uppercase", letterSpacing: "0.18em", fontSize: 12, color: "#7d5a32" }}>${surface.badge}</p>`,
        `        <h1 style={{ marginTop: 8, fontSize: "clamp(2.4rem, 5vw, 4rem)" }}>${surface.heading}</h1>`,
        `        <p style={{ marginTop: 16, maxWidth: 720, fontSize: 18, lineHeight: 1.7, color: "#3a4856" }}>${surface.lead}</p>`,
        "        <dl style={{ marginTop: 28, display: \"grid\", gridTemplateColumns: \"repeat(auto-fit, minmax(220px, 1fr))\", gap: 16 }}>",
        "          {details.map((detail) => (",
        "            <div key={detail.label} style={{ padding: 18, borderRadius: 18, border: \"1px solid #eadfcd\", background: \"#fffaf3\" }}>",
        "              <dt style={{ fontSize: 12, textTransform: \"uppercase\", letterSpacing: \"0.12em\", color: \"#7b6547\" }}>{detail.label}</dt>",
        "              <dd style={{ margin: \"0.6rem 0 0\", fontSize: 18, fontWeight: 600, color: \"#15283b\" }}>{detail.value}</dd>",
        "            </div>",
        "          ))}",
        "        </dl>",
        "        <p style={{ marginTop: 24, fontSize: 14, color: \"#6d5a45\" }}>{generatedWith}</p>",
        "      </section>",
        "    </main>",
        "  );",
        "}",
        "",
      ].join("\n"),
    ),
    ...tailwindSupportFiles(plan),
  ];
}

function frontendFiles(plan: ProjectPlan, context?: FrontendSurfaceContext): GeneratedFile[] {
  switch (plan.frontend?.framework) {
    case "nextjs":
      return nextJsSource(plan, context);
    case "astro":
      return astroSource(plan, context);
    case "nuxt":
      return nuxtSource(plan, context);
    case "vue-vite":
      return vueSource(plan, context);
    case "svelte":
      return svelteSource(plan, context);
    case "sveltekit":
      return svelteKitSource(plan, context);
    case "solidjs":
      return solidSource(plan, context);
    case "angular":
      return angularSource(plan, context);
    case "remix":
      return remixSource(plan, context);
    case "react-vite":
    default:
      return reactAppSource(plan, context);
  }
}

function microfrontendHostFiles(
  plan: ProjectPlan,
  remoteApps: string[],
  port: number,
  context?: FrontendSurfaceContext,
): GeneratedFile[] {
  const surface = frontendSurfaceDetails(plan, context);
  const remotes = remoteApps.map((remoteApp, index) => ({
    key: remoteApp,
    title: toTitleCase(remoteApp),
    moduleName: microfrontendRemoteModuleName(remoteApp),
    port: microfrontendPort(index + 1),
    url: `http://127.0.0.1:${microfrontendPort(index + 1)}`,
    entryUrl: microfrontendRemoteEntryUrl(microfrontendPort(index + 1)),
  }));

  return [
    viteEnvTypesFile(),
    makeFile(
      "index.html",
      [
        "<!doctype html>",
        "<html lang=\"en\">",
        "  <head>",
        "    <meta charset=\"UTF-8\" />",
        "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
        `    <title>${toTitleCase(plan.projectName)} Host</title>`,
        "  </head>",
        "  <body>",
        "    <div id=\"root\"></div>",
        "    <script type=\"module\" src=\"/src/main.tsx\"></script>",
        "  </body>",
        "</html>",
        "",
      ].join("\n"),
    ),
    makeFile(
      "vite.config.ts",
      [
        "import { defineConfig } from \"vite\";",
        "import react from \"@vitejs/plugin-react\";",
        'import federation from "@originjs/vite-plugin-federation";',
        ...viteTailwindPluginImportLines(plan),
        "",
        "export default defineConfig({",
        "  plugins: [",
        "    react(),",
        "    federation({",
        '      name: "host",',
        "      remotes: {",
        ...remotes.map((remote) => `        ${remote.moduleName}: ${JSON.stringify(remote.entryUrl)},`),
        "      },",
        '      shared: ["react", "react-dom"],',
        "    }),",
        ...(plan.frontend?.styling === "tailwind-css" ? ["    tailwindcss(),"] : []),
        "  ],",
        "  server: {",
        '    host: "127.0.0.1",',
        `    port: ${port},`,
        "    strictPort: true,",
        "  },",
        "  preview: {",
        '    host: "127.0.0.1",',
        `    port: ${port},`,
        "    strictPort: true,",
        "  },",
        "  build: {",
        '    target: "esnext",',
        "  },",
        "});",
        "",
      ].join("\n"),
    ),
    makeFile(
      "src/federation-remotes.d.ts",
      [
        'import type { ComponentType } from "react";',
        "",
        ...remotes.flatMap((remote) => [
          `declare module "${remote.moduleName}/RemoteApp" {`,
          "  const RemoteApp: ComponentType;",
          "  export default RemoteApp;",
          "}",
          "",
        ]),
      ].join("\n"),
    ),
    makeFile(
      "src/main.tsx",
      [
        'import React from "react";',
        'import ReactDOM from "react-dom/client";',
        'import App from "./App";',
        'import "./styles.css";',
        "",
        'ReactDOM.createRoot(document.getElementById("root")!).render(',
        "  <React.StrictMode>",
        "    <App />",
        "  </React.StrictMode>,",
        ");",
        "",
      ].join("\n"),
    ),
    makeFile(
      "src/App.tsx",
      [
        'import { useState } from "react";',
        'import type { ComponentType } from "react";',
        "",
        `const details = ${JSON.stringify(surface.entries, null, 2)};`,
        `const generatedWith = ${JSON.stringify(generatedWithText())};`,
        `const remotes = ${JSON.stringify(
          remotes.map((remote) => ({
            key: remote.key,
            title: remote.title,
            url: remote.url,
            moduleName: remote.moduleName,
          })),
          null,
          2,
        )};`,
        "",
        'type RemoteStatus = "idle" | "loading" | "ready" | "error";',
        "",
        "const remoteLoaders = {",
        ...remotes.map((remote) => `  ${JSON.stringify(remote.key)}: () => import("${remote.moduleName}/RemoteApp"),`),
        "} satisfies Record<string, () => Promise<{ default: ComponentType }>>;",
        "",
        "export default function App() {",
        '  const [loadedRemotes, setLoadedRemotes] = useState<Record<string, ComponentType>>({});',
        '  const [statuses, setStatuses] = useState<Record<string, RemoteStatus>>({});',
        '  const [errors, setErrors] = useState<Record<string, string>>({});',
        "",
        "  async function loadRemote(remoteKey: string) {",
        '    setStatuses((current) => ({ ...current, [remoteKey]: "loading" }));',
        '    setErrors((current) => ({ ...current, [remoteKey]: "" }));',
        "",
        "    try {",
        "      const module = await remoteLoaders[remoteKey]();",
        "      setLoadedRemotes((current) => ({ ...current, [remoteKey]: module.default }));",
        '      setStatuses((current) => ({ ...current, [remoteKey]: "ready" }));',
        "    } catch (error) {",
        "      setLoadedRemotes((current) => {",
        "        const next = { ...current };",
        "        delete next[remoteKey];",
        "        return next;",
        "      });",
        '      setStatuses((current) => ({ ...current, [remoteKey]: "error" }));',
        '      setErrors((current) => ({ ...current, [remoteKey]: error instanceof Error ? error.message : String(error) }));',
        "    }",
        "  }",
        "",
        "  return (",
        '    <main style={{ minHeight: "100vh", padding: "3rem 1.5rem", background: "linear-gradient(180deg, #f8f5ef 0%, #efe9dd 100%)", color: "#112233" }}>',
        '      <section style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gap: 24 }}>',
        '        <article style={{ padding: 32, borderRadius: 24, background: "rgba(255, 252, 247, 0.92)", border: "1px solid #e4d8c6", boxShadow: "0 24px 80px rgba(17, 34, 51, 0.08)" }}>',
        '          <p style={{ letterSpacing: "0.18em", textTransform: "uppercase", fontSize: 12, fontWeight: 700, color: "#7d5a32" }}>{' + JSON.stringify(surface.badge) + "}</p>",
        '          <h1 style={{ margin: "0.35rem 0 0", fontSize: "clamp(2.4rem, 5vw, 4rem)" }}>{' + JSON.stringify(surface.heading) + "}</h1>",
        '          <p style={{ marginTop: 16, maxWidth: 760, fontSize: 18, lineHeight: 1.7, color: "#3a4856" }}>{' + JSON.stringify(surface.lead) + "}</p>",
        '          <dl style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>',
        "            {details.map((detail) => (",
        '              <div key={detail.label} style={{ margin: 0, padding: 18, borderRadius: 18, border: "1px solid #eadfcd", background: "#fffaf3" }}>',
        '                <dt style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: "#7b6547" }}>{detail.label}</dt>',
        '                <dd style={{ margin: "0.6rem 0 0", fontSize: 18, fontWeight: 600, color: "#15283b" }}>{detail.value}</dd>',
        "              </div>",
        "            ))}",
        "          </dl>",
        '          <p style={{ marginTop: 24, fontSize: 14, color: "#6d5a45" }}>{generatedWith}</p>',
        "        </article>",
        '        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>',
        "          {remotes.map((remote) => {",
        "            const RemoteComponent = loadedRemotes[remote.key];",
        '            const status = statuses[remote.key] ?? "idle";',
        "            return (",
        '              <article key={remote.key} style={{ padding: 22, borderRadius: 20, border: "1px solid #e4d8c6", background: "#fffaf3" }}>',
        '                <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 11, color: "#7b6547" }}>Remote module</p>',
        '                <h2 style={{ margin: "0.45rem 0 0", fontSize: 24 }}>{remote.title}</h2>',
        '                <p style={{ marginTop: 10, color: "#3a4856", lineHeight: 1.6 }}>Load the remote over Vite federation when you are ready to compose it into the host shell.</p>',
        '                <p style={{ marginTop: 12, fontSize: 13, color: "#6d5a45" }}>Server: {remote.url}</p>',
        '                <p style={{ marginTop: 4, fontSize: 13, color: "#6d5a45" }}>Module: {remote.moduleName}/RemoteApp</p>',
        '                <button type="button" onClick={() => void loadRemote(remote.key)} disabled={status === "loading"} style={{ marginTop: 14, border: 0, borderRadius: 999, padding: "0.8rem 1rem", background: "#1f3a5f", color: "#fffaf3", fontWeight: 700, cursor: "pointer" }}>{status === "loading" ? "Loading..." : RemoteComponent ? "Reload remote" : "Load remote"}</button>',
        '                {status === "error" ? <p style={{ marginTop: 12, color: "#a33b2b", fontSize: 14 }}>Remote unavailable: {errors[remote.key]}</p> : null}',
        '                {RemoteComponent ? <div style={{ marginTop: 16 }}><RemoteComponent /></div> : null}',
        "              </article>",
        "            );",
        "          })}",
        "        </section>",
        "      </section>",
        "    </main>",
        "  );",
        "}",
        "",
      ].join("\n"),
    ),
    makeFile(
      plan.frontend?.styling === "scss" ? "src/styles.scss" : "src/styles.css",
      styleFileContent(plan),
    ),
    ...tailwindSupportFiles(plan),
  ];
}

function microfrontendRemoteFiles(
  plan: ProjectPlan,
  remoteApp: string,
  port: number,
  context?: FrontendSurfaceContext,
): GeneratedFile[] {
  const surface = frontendSurfaceDetails(plan, context);
  const moduleName = microfrontendRemoteModuleName(remoteApp);

  return [
    viteEnvTypesFile(),
    makeFile(
      "index.html",
      [
        "<!doctype html>",
        "<html lang=\"en\">",
        "  <head>",
        "    <meta charset=\"UTF-8\" />",
        "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
        `    <title>${toTitleCase(remoteApp)} Remote</title>`,
        "  </head>",
        "  <body>",
        "    <div id=\"root\"></div>",
        "    <script type=\"module\" src=\"/src/main.tsx\"></script>",
        "  </body>",
        "</html>",
        "",
      ].join("\n"),
    ),
    makeFile(
      "vite.config.ts",
      [
        'import { defineConfig } from "vite";',
        'import react from "@vitejs/plugin-react";',
        'import federation from "@originjs/vite-plugin-federation";',
        ...viteTailwindPluginImportLines(plan),
        "",
        "export default defineConfig({",
        "  plugins: [",
        "    react(),",
        "    federation({",
        `      name: ${JSON.stringify(moduleName)},`,
        '      filename: "remoteEntry.js",',
        "      exposes: {",
        '        "./RemoteApp": "./src/RemoteApp.tsx",',
        "      },",
        '      shared: ["react", "react-dom"],',
        "    }),",
        ...(plan.frontend?.styling === "tailwind-css" ? ["    tailwindcss(),"] : []),
        "  ],",
        "  server: {",
        '    host: "127.0.0.1",',
        `    port: ${port},`,
        "    strictPort: true,",
        "  },",
        "  preview: {",
        '    host: "127.0.0.1",',
        `    port: ${port},`,
        "    strictPort: true,",
        "  },",
        "  build: {",
        '    target: "esnext",',
        "    modulePreload: false,",
        "    cssCodeSplit: false,",
        "  },",
        "});",
        "",
      ].join("\n"),
    ),
    makeFile(
      "src/main.tsx",
      [
        'import React from "react";',
        'import ReactDOM from "react-dom/client";',
        'import App from "./App";',
        'import "./styles.css";',
        "",
        'ReactDOM.createRoot(document.getElementById("root")!).render(',
        "  <React.StrictMode>",
        "    <App />",
        "  </React.StrictMode>,",
        ");",
        "",
      ].join("\n"),
    ),
    makeFile(
      "src/RemoteApp.tsx",
      [
        "export default function RemoteApp() {",
        "  return (",
        '    <section style={{ padding: 18, borderRadius: 18, border: "1px solid #eadfcd", background: "#fffaf3" }}>',
        '      <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 11, color: "#7b6547" }}>Federated remote</p>',
        `      <h3 style={{ margin: "0.4rem 0 0", fontSize: 22 }}>${toTitleCase(remoteApp)}</h3>`,
        `      <p style={{ marginTop: 10, lineHeight: 1.6, color: "#3a4856" }}>Exposed as ${moduleName}/RemoteApp for the host shell.</p>`,
        "    </section>",
        "  );",
        "}",
        "",
      ].join("\n"),
    ),
    makeFile(
      "src/App.tsx",
      [
        'import RemoteApp from "./RemoteApp";',
        "",
        `const details = ${JSON.stringify(surface.entries, null, 2)};`,
        `const generatedWith = ${JSON.stringify(generatedWithText())};`,
        "",
        "export default function App() {",
        "  return (",
        '    <main style={{ minHeight: "100vh", padding: "3rem 1.5rem", background: "linear-gradient(180deg, #f8f5ef 0%, #efe9dd 100%)", color: "#112233" }}>',
        '      <section style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 20 }}>',
        '        <article style={{ padding: 32, borderRadius: 24, background: "rgba(255, 252, 247, 0.92)", border: "1px solid #e4d8c6", boxShadow: "0 24px 80px rgba(17, 34, 51, 0.08)" }}>',
        '          <p style={{ letterSpacing: "0.18em", textTransform: "uppercase", fontSize: 12, fontWeight: 700, color: "#7d5a32" }}>{' + JSON.stringify(surface.badge) + "}</p>",
        '          <h1 style={{ margin: "0.35rem 0 0", fontSize: "clamp(2.2rem, 5vw, 3.6rem)" }}>{' + JSON.stringify(surface.heading) + "}</h1>",
        '          <p style={{ marginTop: 16, maxWidth: 720, fontSize: 18, lineHeight: 1.7, color: "#3a4856" }}>{' + JSON.stringify(surface.lead) + "}</p>",
        '          <dl style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>',
        "            {details.map((detail) => (",
        '              <div key={detail.label} style={{ margin: 0, padding: 18, borderRadius: 18, border: "1px solid #eadfcd", background: "#fffaf3" }}>',
        '                <dt style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: "#7b6547" }}>{detail.label}</dt>',
        '                <dd style={{ margin: "0.6rem 0 0", fontSize: 18, fontWeight: 600, color: "#15283b" }}>{detail.value}</dd>',
        "              </div>",
        "            ))}",
        "          </dl>",
        '          <p style={{ marginTop: 24, fontSize: 14, color: "#6d5a45" }}>{generatedWith}</p>',
        "        </article>",
        "        <RemoteApp />",
        "      </section>",
        "    </main>",
        "  );",
        "}",
        "",
      ].join("\n"),
    ),
    makeFile(
      plan.frontend?.styling === "scss" ? "src/styles.scss" : "src/styles.css",
      styleFileContent(plan),
    ),
    ...tailwindSupportFiles(plan),
  ];
}

function backendServerSource(plan: ProjectPlan): string {
  const framework = plan.backend?.framework ?? "hono";
  const projectInfo = JSON.stringify(
    projectMetadataPayload(plan, {
      service: "api",
      endpoints: {
        self: "/",
        health: "/health",
      },
    }),
    null,
    2,
  );

  switch (framework) {
    case "express":
      return [
        "import express from \"express\";",
        "import cors from \"cors\";",
        "",
        `const projectInfo = ${projectInfo};`,
        "",
        "const app = express();",
        "app.use(cors());",
        "app.get(\"/\", (_req, res) => res.json(projectInfo));",
        "app.get(\"/health\", (_req, res) => res.json({ ok: true, status: \"healthy\", ...projectInfo }));",
        "",
        "const port = Number(process.env.PORT ?? 3001);",
        "app.listen(port, () => {",
        "  console.log(`API listening on http://localhost:${port}`);",
        "});",
        "",
      ].join("\n");
    case "fastify":
      return [
        "import Fastify from \"fastify\";",
        "",
        `const projectInfo = ${projectInfo};`,
        "",
        "const app = Fastify();",
        "app.get(\"/\", async () => projectInfo);",
        "app.get(\"/health\", async () => ({ ok: true, status: \"healthy\", ...projectInfo }));",
        "",
        "const port = Number(process.env.PORT ?? 3001);",
        "app.listen({ port });",
        "",
      ].join("\n");
    case "koa":
      return [
        "import Koa from \"koa\";",
        "",
        `const projectInfo = ${projectInfo};`,
        "",
        "const app = new Koa();",
        "app.use(async (ctx) => {",
        "  if (ctx.path === \"/health\") {",
        "    ctx.body = { ok: true, status: \"healthy\", ...projectInfo };",
        "    return;",
        "  }",
        "",
        "  ctx.body = projectInfo;",
        "});",
        "",
        "const port = Number(process.env.PORT ?? 3001);",
        "app.listen(port);",
        "",
      ].join("\n");
    case "nestjs":
      return [
        "import { NestFactory } from \"@nestjs/core\";",
        "import { Module, Controller, Get } from \"@nestjs/common\";",
        "",
        `const projectInfo = ${projectInfo};`,
        "",
        "@Controller()",
        "class AppController {",
        "  @Get()",
        "  info() {",
        "    return projectInfo;",
        "  }",
        "",
        "  @Get(\"health\")",
        "  health() {",
        "    return { ok: true, status: \"healthy\", ...projectInfo };",
        "  }",
        "}",
        "",
        "@Module({ controllers: [AppController] })",
        "class AppModule {}",
        "",
        "async function bootstrap() {",
        "  const app = await NestFactory.create(AppModule);",
        "  await app.listen(Number(process.env.PORT ?? 3001));",
        "}",
        "",
        "bootstrap();",
        "",
      ].join("\n");
    case "hono":
    default:
      return [
        "import { Hono } from \"hono\";",
        "import { serve } from \"@hono/node-server\";",
        "",
        `const projectInfo = ${projectInfo};`,
        "",
        "const app = new Hono();",
        "app.get(\"/\", (c) => c.json(projectInfo));",
        "app.get(\"/health\", (c) => c.json({ ok: true, status: \"healthy\", ...projectInfo }));",
        "",
        "serve({",
        "  fetch: app.fetch,",
        "  port: Number(process.env.PORT ?? 3001),",
        "});",
        "",
      ].join("\n");
  }
}

function backendFiles(plan: ProjectPlan): GeneratedFile[] {
  const extension = plan.backend?.language === "javascript" ? "js" : "ts";
  const files = [makeFile(`src/server.${extension}`, backendServerSource(plan))];

  if (plan.backend?.orm === "prisma") {
    files.push(
      makeFile(
        "prisma/schema.prisma",
        [
          "generator client {",
          "  provider = \"prisma-client-js\"",
          "}",
          "",
          "datasource db {",
          `  provider = "${plan.backend.database === "mongodb" ? "mongodb" : "postgresql"}"`,
          "  url      = env(\"DATABASE_URL\")",
          "}",
          "",
          "model User {",
          "  id    String @id @default(cuid())",
          "  email String @unique",
          "}",
          "",
        ].join("\n"),
      ),
    );
  }

  if (plan.backend?.orm === "drizzle") {
    files.push(
      makeFile(
        `src/db/schema.${extension}`,
        [
          "export const schemaNotes = {",
          "  message: \"Define your Drizzle tables here.\",",
          "};",
          "",
        ].join("\n"),
      ),
    );
  }

  return files;
}

function cliToolFiles(plan: ProjectPlan): GeneratedFile[] {
  const projectInfo = JSON.stringify(
    projectMetadataPayload(plan, {
      service: "cli",
      commands: ["info", "--json", "--help"],
    }),
    null,
    2,
  );

  return [
    makeFile(
      "src/index.ts",
      [
        "#!/usr/bin/env node",
        "",
        "const args = process.argv.slice(2);",
        `const projectInfo = ${projectInfo};`,
        "",
        "function printSummary() {",
        `  console.log(${JSON.stringify(toTitleCase(plan.projectName) + " CLI scaffold")});`,
        `  console.log(${JSON.stringify(plan.metadata.description)});`,
        `  console.log(${JSON.stringify(generatedWithText())});`,
        "  console.log(\"\");",
        "  console.log(`Intent: ${projectInfo.project.intent}`);",
        "  console.log(`Architecture: ${projectInfo.project.architecture}`);",
        "  console.log(`Package manager: ${projectInfo.project.packageManager}`);",
        "  console.log(\"Run --json for the full project manifest.\");",
        "}",
        "",
        "if (args.includes(\"--help\")) {",
        `  console.log("Usage: ${plan.projectName} [command]\\n\\nCommands:\\n  info    Print the scaffold summary\\n\\nFlags:\\n  --json  Print full project metadata as JSON\\n  --help  Show this help message");`,
        "} else if (args.includes(\"--json\") || args[0] === \"info\") {",
        "  console.log(JSON.stringify(projectInfo, null, 2));",
        "} else {",
        "  printSummary();",
        "}",
        "",
      ].join("\n"),
      true,
    ),
  ];
}

function chromeExtensionFiles(plan: ProjectPlan): GeneratedFile[] {
  const manifest = {
    manifest_version: 3,
    name: toTitleCase(plan.projectName),
    version: generatedProjectVersion(),
    action: plan.extension?.includesPopup
      ? {
          default_popup: "popup.html",
        }
      : undefined,
    background: plan.extension?.includesBackground
      ? {
          service_worker: "src/background.js",
        }
      : undefined,
    content_scripts: plan.extension?.includesContent
      ? [
          {
            matches: ["<all_urls>"],
            js: ["src/content.js"],
          },
        ]
      : undefined,
  };
  const extensionInfo = JSON.stringify(
    projectMetadataPayload(plan, {
      service: "chrome-extension",
      extension: {
        includesBackground: plan.extension?.includesBackground ?? false,
        includesContent: plan.extension?.includesContent ?? false,
        includesPopup: plan.extension?.includesPopup ?? false,
      },
    }),
    null,
    2,
  );
  const files: GeneratedFile[] = [
    makeFile(
      "public/manifest.json",
      stringifyJson(manifest),
    ),
    makeFile(
      "vite.config.ts",
      [
        "import { defineConfig } from \"vite\";",
        ...(plan.extension?.flavor === "react"
          ? ["import react from \"@vitejs/plugin-react\";"]
          : []),
        "import { resolve } from \"node:path\";",
        "",
        "export default defineConfig({",
        ...(plan.extension?.flavor === "react" ? ["  plugins: [react()],"] : []),
        "  build: {",
        "    rollupOptions: {",
        "      input: {",
        ...(plan.extension?.includesPopup ? ['        popup: resolve(__dirname, "popup.html"),'] : []),
        ...(plan.extension?.includesBackground
          ? ['        background: resolve(__dirname, "src/background.ts"),']
          : []),
        ...(plan.extension?.includesContent
          ? ['        content: resolve(__dirname, "src/content.ts"),']
          : []),
        "      },",
        "      output: {",
        "        entryFileNames: (chunkInfo) => {",
        "          if (chunkInfo.name === \"background\") {",
        "            return \"src/background.js\";",
        "          }",
        "          if (chunkInfo.name === \"content\") {",
        "            return \"src/content.js\";",
        "          }",
        "          return \"assets/[name]-[hash].js\";",
        "        },",
        "      },",
        "    },",
        "  },",
        "});",
        "",
      ].join("\n"),
    ),
  ];

  if (plan.extension?.includesBackground) {
    files.push(
      makeFile(
        "src/background.ts",
        [
          `const extensionInfo = ${extensionInfo};`,
          "",
          "chrome.runtime.onInstalled.addListener(() => {",
          "  console.log(\"Extension installed\", extensionInfo);",
          "});",
          "",
        ].join("\n"),
      ),
    );
  }

  if (plan.extension?.includesContent) {
    files.push(
      makeFile(
        "src/content.ts",
        [
          `const extensionInfo = ${extensionInfo};`,
          "",
          "console.log(\"DevForge content script ready\", extensionInfo);",
          "",
        ].join("\n"),
      ),
    );
  }

  if (plan.extension?.includesPopup) {
    files.push(makeFile("popup.html", "<div id=\"root\"></div>\n<script type=\"module\" src=\"/src/popup.tsx\"></script>\n"));
    files.push(
      makeFile(
        "src/popup.tsx",
        plan.extension.flavor === "react"
          ? [
              "import React from \"react\";",
              "import ReactDOM from \"react-dom/client\";",
              "",
              `const extensionInfo = ${extensionInfo};`,
              `const details = ${JSON.stringify(projectDetailsEntries(plan), null, 2)};`,
              `const generatedWith = ${JSON.stringify(generatedWithText())};`,
              "",
              "function Popup() {",
              "  return (",
              "    <main style={{ minWidth: 360, padding: 18, fontFamily: 'Georgia, serif', color: '#112233', background: 'linear-gradient(180deg, #f8f5ef 0%, #efe9dd 100%)' }}>",
              `      <p style={{ textTransform: "uppercase", letterSpacing: "0.18em", fontSize: 11, color: "#7d5a32" }}>Extension details</p>`,
              `      <h1 style={{ margin: "0.35rem 0 0" }}>${toTitleCase(plan.projectName)}</h1>`,
              `      <p style={{ lineHeight: 1.6, color: "#3a4856" }}>${plan.metadata.description}</p>`,
              "      <dl style={{ display: 'grid', gap: 12, marginTop: 16 }}>",
              "        {details.map((detail) => (",
              "          <div key={detail.label} style={{ padding: 12, borderRadius: 14, background: '#fffaf3', border: '1px solid #eadfcd' }}>",
              "            <dt style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#7b6547' }}>{detail.label}</dt>",
              "            <dd style={{ margin: '0.45rem 0 0', fontSize: 16, fontWeight: 600, color: '#15283b' }}>{detail.value}</dd>",
              "          </div>",
              "        ))}",
              "      </dl>",
              "      <pre style={{ marginTop: 16, padding: 12, borderRadius: 14, background: '#1b2430', color: '#f8f5ef', fontSize: 11, overflow: 'auto' }}>{JSON.stringify(extensionInfo, null, 2)}</pre>",
              "      <p style={{ marginTop: 14, fontSize: 12, color: '#6d5a45' }}>{generatedWith}</p>",
              "    </main>",
              "  );",
              "}",
              "",
              "ReactDOM.createRoot(document.getElementById(\"root\")!).render(<Popup />);",
              "",
            ].join("\n")
          : [
              `const extensionInfo = ${extensionInfo};`,
              `const details = ${JSON.stringify(projectDetailsEntries(plan), null, 2)};`,
              `const generatedWith = ${JSON.stringify(generatedWithText())};`,
              "",
              "const root = document.getElementById(\"root\");",
              "if (root) {",
              "  const items = details",
              "    .map((detail) => `<div style=\"padding:12px;border-radius:14px;background:#fffaf3;border:1px solid #eadfcd\"><dt style=\"font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#7b6547\">${detail.label}</dt><dd style=\"margin:0.45rem 0 0;font-size:16px;font-weight:600;color:#15283b\">${detail.value}</dd></div>`)",
              "    .join(\"\");",
              `  root.innerHTML = \`<main style="min-width:360px;padding:18px;font-family:Georgia,serif;color:#112233;background:linear-gradient(180deg,#f8f5ef 0%,#efe9dd 100%)"><p style="text-transform:uppercase;letter-spacing:0.18em;font-size:11px;color:#7d5a32">Extension details</p><h1 style="margin:0.35rem 0 0">${toTitleCase(plan.projectName)}</h1><p style="line-height:1.6;color:#3a4856">${plan.metadata.description}</p><dl style="display:grid;gap:12px;margin-top:16px">\${items}</dl><pre style="margin-top:16px;padding:12px;border-radius:14px;background:#1b2430;color:#f8f5ef;font-size:11px;overflow:auto">\${JSON.stringify(extensionInfo, null, 2)}</pre><p style="margin-top:14px;font-size:12px;color:#6d5a45">\${generatedWith}</p></main>\`;`,
              "}",
              "",
            ].join("\n"),
      ),
    );
  }

  return files;
}

function docsFiles(plan: ProjectPlan): GeneratedFile[] {
  const files = [
    makeFile("docs/architecture.md", architectureDoc(plan)),
    makeFile("docs/getting-started.md", gettingStartedDoc(plan)),
    makeFile("LICENSE", licenseText(plan.metadata.license)),
  ];

  if (plan.metadata.generateReadme) {
    files.unshift(makeFile("README.md", readme(plan)));
  }

  return files;
}

function ciWorkflow(plan: ProjectPlan): string {
  const lines = [
    "name: CI",
    "",
    "on:",
    "  push:",
    "  pull_request:",
    "",
    "jobs:",
    "  validate:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v5",
  ];

  if (plan.packageManager === "bun") {
    lines.push(
      "      - uses: oven-sh/setup-bun@v2",
      "        with:",
      "          bun-version: latest",
    );
  } else {
    lines.push(
      "      - uses: actions/setup-node@v6",
      "        with:",
      "          node-version: 22.12.0",
      `          cache: ${plan.packageManager}`,
    );

    if (plan.packageManager === "pnpm" || plan.packageManager === "yarn") {
      lines.push("      - run: corepack enable");
    }
  }

  lines.push(
    `      - run: ${packageManagerCiInstallCommand(plan.packageManager)}`,
    `      - run: ${packageManagerRunCommand(plan.packageManager, "check")}`,
    "",
  );

  return lines.join("\n");
}

function dockerfile(plan: ProjectPlan): string {
  if (plan.packageManager === "bun") {
    return [
      "FROM oven/bun:1.2",
      "WORKDIR /app",
      "COPY package.json bun.lockb* ./",
      "RUN bun install",
      "COPY . .",
      "CMD [\"bun\", \"run\", \"dev\"]",
      "",
    ].join("\n");
  }

  const setupLines =
    plan.packageManager === "pnpm" || plan.packageManager === "yarn"
      ? ["RUN corepack enable"]
      : [];
  const installCommand = packageManagerInstallCommand(plan.packageManager);
  const runCommand = packageManagerRunCommand(plan.packageManager, "dev").split(" ");

  return [
    "FROM node:22-alpine",
    "WORKDIR /app",
    "COPY package.json ./",
    ...setupLines,
    `RUN ${installCommand}`,
    "COPY . .",
    `CMD ${JSON.stringify(runCommand)}`,
    "",
  ].join("\n");
}

function eslintConfigContent(plan: ProjectPlan): string {
  const strictRules =
    plan.tooling.eslintProfile === "strict"
      ? [
          "      \"@typescript-eslint/no-explicit-any\": \"error\",",
          "      \"@typescript-eslint/explicit-function-return-type\": \"warn\",",
          "      \"@typescript-eslint/no-floating-promises\": \"error\",",
          "      \"eqeqeq\": \"error\",",
        ]
      : [];
  const moderateRules =
    plan.tooling.eslintProfile === "moderate" || plan.tooling.eslintProfile === "strict"
      ? [
          "      \"@typescript-eslint/consistent-type-imports\": \"error\",",
          "      \"@typescript-eslint/no-unused-vars\": [\"error\", { \"argsIgnorePattern\": \"^_\", \"varsIgnorePattern\": \"^_\" }],",
        ]
      : [];

  return [
    "import js from \"@eslint/js\";",
    "import tseslint from \"typescript-eslint\";",
    "",
    "export default [",
    "  {",
    "    ignores: [\"dist/**\", \"coverage/**\"],",
    "  },",
    "  js.configs.recommended,",
    "  ...tseslint.configs.recommended,",
    "  {",
    "    rules: {",
    "      \"no-console\": \"off\",",
    ...moderateRules,
    ...strictRules,
    "    },",
    "  },",
    "];",
    "",
  ].join("\n");
}

function prettierConfigContent(plan: ProjectPlan): string {
  if (plan.tooling.prettierProfile === "low") {
    return stringifyJson({
      semi: true,
      singleQuote: false,
      trailingComma: "none",
      printWidth: 100,
    });
  }

  if (plan.tooling.prettierProfile === "strict") {
    return stringifyJson({
      semi: true,
      singleQuote: false,
      trailingComma: "all",
      printWidth: 88,
      proseWrap: "always",
      arrowParens: "always",
    });
  }

  return stringifyJson({
    semi: true,
    singleQuote: false,
    trailingComma: "all",
    printWidth: 90,
  });
}

function huskyFiles(plan: ProjectPlan): GeneratedFile[] {
  if (!plan.tooling.husky) {
    return [];
  }

  const files = [
    makeFile(
      ".husky/pre-commit",
      `${packageManagerRunCommand(
        plan.packageManager,
        plan.tooling.huskyProfile === "low" ? "lint" : "check",
      )}\n`,
      true,
    ),
  ];

  if (plan.tooling.commitlint && plan.tooling.huskyProfile !== "low") {
    files.push(
      makeFile(
        ".husky/commit-msg",
        "npx --no -- commitlint --edit \"$1\"\n",
        true,
      ),
    );
  }

  if (plan.tooling.huskyProfile === "strict") {
    const command =
      plan.testing.enabled && (plan.testing.runner === "vitest" || plan.testing.runner === "jest")
        ? packageManagerRunCommand(plan.packageManager, "test")
        : packageManagerRunCommand(plan.packageManager, "check");
    files.push(makeFile(".husky/pre-push", `${command}\n`, true));
  }

  return files;
}

function testingFiles(plan: ProjectPlan): GeneratedFile[] {
  if (!plan.testing.enabled || !plan.testing.includeExampleTests) {
    return [];
  }

  const configExtension = usesTypeScript(plan) ? "ts" : "js";
  const jestConfigExtension = usesTypeScript(plan) ? "ts" : "cjs";
  const testExtension = usesTypeScript(plan) ? "ts" : "js";

  if (plan.testing.runner === "vitest") {
    const environment =
      plan.testing.environment === "happy-dom" ? "happy-dom" : plan.testing.environment;
    return [
      makeFile(
        `vitest.config.${configExtension}`,
        [
          "import { defineConfig } from \"vitest/config\";",
          "",
          "export default defineConfig({",
          "  test: {",
          `    environment: "${environment}",`,
          "  },",
          "});",
          "",
        ].join("\n"),
      ),
      makeFile(
        plan.frontend || plan.intent === "chrome-extension"
          ? `src/__tests__/app.test.${testExtension}`
          : `src/__tests__/health.test.${testExtension}`,
        [
          "import { describe, expect, it } from \"vitest\";",
          "",
          "describe(\"starter test\", () => {",
          "  it(\"keeps the scaffold wired\", () => {",
          "    expect(true).toBe(true);",
          "  });",
          "});",
          "",
        ].join("\n"),
      ),
    ];
  }

  if (plan.testing.runner === "jest") {
    return [
      makeFile(
        `jest.config.${jestConfigExtension}`,
        [
          ...(usesTypeScript(plan)
            ? [
                "import type { Config } from \"jest\";",
                "",
                "const config: Config = {",
              ]
            : ["const config = {"]),
          `  testEnvironment: "${plan.testing.environment === "node" ? "node" : "jsdom"}",`,
          `  testMatch: ["**/*.test.${testExtension}", "**/*.test.${usesTypeScript(plan) ? "tsx" : "jsx"}"],`,
          "};",
          "",
          usesTypeScript(plan) ? "export default config;" : "module.exports = config;",
          "",
        ].join("\n"),
      ),
      makeFile(
        `src/__tests__/starter.test.${testExtension}`,
        [
          "describe(\"starter test\", () => {",
          "  it(\"keeps the scaffold wired\", () => {",
          "    expect(true).toBe(true);",
          "  });",
          "});",
          "",
        ].join("\n"),
      ),
    ];
  }

  if (plan.testing.runner === "playwright") {
    return [
      makeFile(
        `playwright.config.${configExtension}`,
        [
          "import { defineConfig } from \"@playwright/test\";",
          "",
          "export default defineConfig({",
          "  testDir: \"tests\",",
          "  use: {",
          "    baseURL: \"http://127.0.0.1:3000\",",
          "  },",
          "});",
          "",
        ].join("\n"),
      ),
      makeFile(
        `tests/smoke.spec.${testExtension}`,
        [
          "import { expect, test } from \"@playwright/test\";",
          "",
          "test(\"placeholder smoke test\", async ({ page }) => {",
          "  await page.goto(\"/\");",
          "  await expect(page).toHaveTitle(/./);",
          "});",
          "",
        ].join("\n"),
      ),
    ];
  }

  if (plan.testing.runner === "cypress") {
    return [
      makeFile(
        `cypress.config.${configExtension}`,
        [
          "import { defineConfig } from \"cypress\";",
          "",
          "export default defineConfig({",
          "  e2e: {",
          "    baseUrl: \"http://127.0.0.1:3000\",",
          "  },",
          "});",
          "",
        ].join("\n"),
      ),
      makeFile(
        `cypress/e2e/starter.cy.${testExtension}`,
        [
          "describe(\"starter smoke test\", () => {",
          "  it(\"loads the app shell\", () => {",
          "    cy.visit(\"/\");",
          "  });",
          "});",
          "",
        ].join("\n"),
      ),
    ];
  }

  return [];
}

function toolingFiles(plan: ProjectPlan, options?: { includeTesting?: boolean }): GeneratedFile[] {
  const includeTesting = options?.includeTesting ?? true;
  const files: GeneratedFile[] = [
    makeFile(".editorconfig", editorConfigContent()),
    makeFile(".gitattributes", "* text=auto eol=lf\n"),
  ];

  if (usesTypeScript(plan)) {
    files.push(makeFile("tsconfig.json", rootTsConfig(plan)));
  }

  if (plan.tooling.eslint) {
    files.push(
      makeFile(
        "eslint.config.js",
        eslintConfigContent(plan),
      ),
    );
  }

  if (plan.tooling.prettier) {
    files.push(
      makeFile(
        ".prettierrc",
        prettierConfigContent(plan),
      ),
    );
  }

  files.push(...huskyFiles(plan));

  if (plan.tooling.commitlint) {
    files.push(
      makeFile(
        "commitlint.config.cjs",
        "module.exports = { extends: [\"@commitlint/config-conventional\"] };\n",
      ),
    );
  }

  if (plan.tooling.githubActions) {
    files.push(
      makeFile(
        ".github/workflows/ci.yml",
        ciWorkflow(plan),
      ),
    );
  }

  if (plan.tooling.docker) {
    files.push(
      makeFile(
        "Dockerfile",
        dockerfile(plan),
      ),
    );
    files.push(makeFile(".dockerignore", "node_modules\ndist\n.git\ncoverage\n"));
  }

  if (includeTesting) {
    files.push(...testingFiles(plan));
  }

  return files;
}

function fullstackExtras(plan: ProjectPlan): GeneratedFile[] {
  if (plan.intent !== "fullstack-app") {
    return [];
  }

  if (plan.frontend?.framework === "nextjs") {
    const projectInfo = JSON.stringify(
      projectMetadataPayload(plan, {
        service: "fullstack-api",
        endpoints: {
          health: "/api/health",
        },
      }),
      null,
      2,
    );

    return [
      makeFile(
        "app/api/health/route.ts",
        [
          `const projectInfo = ${projectInfo};`,
          "",
          "export async function GET() {",
          "  return Response.json({ ok: true, status: \"healthy\", ...projectInfo });",
          "}",
          "",
        ].join("\n"),
      ),
    ];
  }

  return [
    ...(backendUsesTypeScript(plan)
      ? [
          makeFile(
            "tsconfig.server.json",
            nodeTsConfig(plan, ["src/server.ts", "**/*.d.ts"], {
              outDir: "dist-api",
              rootDir: ".",
            }),
          ),
        ]
      : []),
    ...backendFiles(plan),
  ];
}

function prefixFiles(prefix: string, files: GeneratedFile[]): GeneratedFile[] {
  return files.map((file) => ({
    ...file,
    path: `${prefix}/${file.path}`.replace(/\/+/g, "/"),
  }));
}

function workspaceRootDevDependencies(plan: ProjectPlan): Record<string, string> {
  const devDependencies: Record<string, string> = {};

  if (usesTypeScript(plan)) {
    addRecord(devDependencies, {
      "@types/node": "latest",
      tsx: "latest",
      typescript: "latest",
    });
  }

  if (plan.tooling.eslint) {
    addRecord(devDependencies, {
      "@eslint/js": "latest",
      eslint: "latest",
      "typescript-eslint": "latest",
    });
  }

  if (plan.tooling.prettier) {
    addRecord(devDependencies, {
      prettier: "latest",
    });
  }

  if (plan.tooling.husky) {
    addRecord(devDependencies, {
      husky: "latest",
    });
  }

  if (plan.tooling.commitlint) {
    addRecord(devDependencies, {
      "@commitlint/cli": "latest",
      "@commitlint/config-conventional": "latest",
    });
  }

  return devDependencies;
}

function workspaceRootPackageJson(
  plan: ProjectPlan,
  tool: ProjectPlan["workspace"]["tool"],
  packageManagerMetadata: PackageManagerMetadata,
): GeneratedFile {
  const devDependencies: Record<string, string> = workspaceRootDevDependencies(plan);
  const scripts: Record<string, string> =
    tool === "nx"
      ? {
          dev: "nx run-many -t dev",
          build: "nx run-many -t build",
        }
      : {
          dev: "turbo dev",
          build: "turbo build",
        };

  if (plan.testing.enabled && (plan.testing.runner === "vitest" || plan.testing.runner === "jest")) {
    scripts.test = tool === "nx" ? "nx run-many -t test" : "turbo run test";
  }

  if (plan.testing.enabled && (plan.testing.runner === "playwright" || plan.testing.runner === "cypress")) {
    scripts["test:e2e"] = tool === "nx" ? "nx run-many -t test:e2e" : "turbo run test:e2e";
  }

  if (tool === "turborepo") {
    devDependencies.turbo = "latest";
  }

  if (tool === "nx") {
    devDependencies.nx = "latest";
  }

  const data: PackageJsonShape = {
    name: plan.projectName,
    version: generatedProjectVersion(),
    private: true,
    type: "module",
    packageManager: packageManagerField(packageManagerMetadata),
    pnpm: pnpmPackageConfig(plan),
    workspaces: ["apps/*", "packages/*"],
    scripts: sortRecord(appendQualityScripts(plan, scripts)),
    engines: {
      node: generatedProjectNodeEngine(plan),
    },
    devDependencies: sortRecord(devDependencies),
  };

  return makeFile("package.json", stringifyJson(data));
}

function workspaceFiles(
  plan: ProjectPlan,
  packageManagerMetadata: PackageManagerMetadata,
  options?: { includeDefaultApps?: boolean },
): GeneratedFile[] {
  const tool = plan.workspace.tool ?? "turborepo";
  const includeDefaultApps = options?.includeDefaultApps ?? true;
  const files: GeneratedFile[] = [
    workspaceRootPackageJson(plan, tool, packageManagerMetadata),
    makeFile(".gitignore", rootGitignore()),
    ...docsFiles(plan),
    ...toolingFiles(plan, { includeTesting: false }),
  ];

  if (shouldGenerateNodeVersionFile(plan)) {
    files.push(makeFile(".nvmrc", `${nodeVersionSpec(plan)}\n`));
  }

  if (plan.metadata.generateEnvExample) {
    files.push(makeFile(".env.example", envExample(plan)));
  }

  if (plan.packageManager === "pnpm") {
    files.push(makeFile("pnpm-workspace.yaml", "packages:\n  - apps/*\n  - packages/*\n"));
  }

  if (tool === "turborepo") {
    files.push(
      makeFile(
        "turbo.json",
        stringifyJson({
          $schema: "https://turbo.build/schema.json",
          tasks: {
            dev: { cache: false },
            build: { dependsOn: ["^build"], outputs: ["dist/**", ".next/**"] },
          },
        }),
      ),
    );
  } else {
    files.push(
      makeFile(
        "nx.json",
        stringifyJson({
          npmScope: plan.projectName,
          affected: { defaultBase: "main" },
        }),
      ),
    );
  }

  if (includeDefaultApps && plan.frontend) {
    const webPlan: ProjectPlan = {
      ...plan,
      intent: "frontend-app",
      architecture: "simple",
      backend: undefined,
      tooling: {
        ...plan.tooling,
        husky: false,
        commitlint: false,
        githubActions: false,
        docker: false,
      },
    };
    files.push(
      makeFile(
        "apps/web/package.json",
        stringifyJson({
          name: `${plan.projectName}-web`,
          version: generatedProjectVersion(),
          private: true,
          type: "module",
          packageManager: packageManagerField(packageManagerMetadata),
          scripts: sortRecord(singlePackageScripts(webPlan)),
          dependencies: sortRecord(collectDependencies(webPlan).dependencies),
          devDependencies: sortRecord(collectDependencies(webPlan).devDependencies),
        }),
      ),
    );
    if (usesTypeScript(webPlan)) {
      files.push(makeFile("apps/web/tsconfig.json", localTsConfig(webPlan)));
    }
    files.push(...prefixFiles("apps/web", testingFiles(webPlan)));
    files.push(...prefixFiles("apps/web", frontendFiles(webPlan)));
  }

  if (includeDefaultApps && plan.backend) {
    const apiPlan: ProjectPlan = {
      ...plan,
      intent: "backend-api",
      architecture: "simple",
      frontend: undefined,
      tooling: {
        ...plan.tooling,
        husky: false,
        commitlint: false,
        githubActions: false,
        docker: false,
      },
    };
    files.push(
      makeFile(
        "apps/api/package.json",
        stringifyJson({
          name: `${plan.projectName}-api`,
          version: generatedProjectVersion(),
          private: true,
          type: "module",
          packageManager: packageManagerField(packageManagerMetadata),
          scripts: sortRecord(singlePackageScripts(apiPlan)),
          dependencies: sortRecord(collectDependencies(apiPlan).dependencies),
          devDependencies: sortRecord(collectDependencies(apiPlan).devDependencies),
        }),
      ),
    );
    if (usesTypeScript(apiPlan)) {
      files.push(
        makeFile(
          "apps/api/tsconfig.json",
          localTsConfig(apiPlan, ["src", "tests", "cypress", "**/*.d.ts"]),
        ),
      );
    }
    files.push(...prefixFiles("apps/api", testingFiles(apiPlan)));
    files.push(...prefixFiles("apps/api", backendFiles(apiPlan)));
  }

  files.push(
    makeFile(
      "packages/shared/README.md",
      [
        "# Shared Package",
        "",
        "Move cross-app utilities, tokens, and typed contracts here.",
        "",
      ].join("\n"),
    ),
  );

  return files;
}

function microfrontendFiles(
  plan: ProjectPlan,
  packageManagerMetadata: PackageManagerMetadata,
): GeneratedFile[] {
  const hostPort = microfrontendPort(0);
  const workspacePlan: ProjectPlan = {
    ...plan,
    architecture: "microfrontend",
    workspace: {
      ...plan.workspace,
      tool: "turborepo",
      remoteApps: plan.workspace.remoteApps.length > 0 ? plan.workspace.remoteApps : ["catalog", "dashboard"],
    },
  };

  const files = workspaceFiles(workspacePlan, packageManagerMetadata, {
    includeDefaultApps: false,
  });
  files.push(
    makeFile(
      "docs/microfrontends.md",
      [
        "# Microfrontend Map",
        "",
        `- Strategy: ${toTitleCase(workspacePlan.workspace.microfrontendStrategy ?? "vite-federation")}`,
        `- Host app: apps/host`,
        ...workspacePlan.workspace.remoteApps.map((app) => `- Remote: apps/remote-${app}`),
        "",
      ].join("\n"),
    ),
  );

  const hostPlan: ProjectPlan = {
    ...workspacePlan,
    intent: "frontend-app",
    architecture: "microfrontend",
    backend: undefined,
    tooling: {
      ...workspacePlan.tooling,
      husky: false,
      commitlint: false,
      githubActions: false,
      docker: false,
    },
    frontend: workspacePlan.frontend ?? {
      framework: "react-vite",
      rendering: "client",
      styling: "tailwind-css",
      uiLibrary: "none",
      state: "none",
      dataFetching: "native-fetch",
    },
  };

  files.push(
    makeFile(
      "apps/host/package.json",
      stringifyJson({
        name: `${workspacePlan.projectName}-host`,
        version: generatedProjectVersion(),
        private: true,
        type: "module",
        packageManager: packageManagerField(packageManagerMetadata),
        pnpm: pnpmPackageConfig(hostPlan),
        scripts: sortRecord(microfrontendHostScripts(hostPlan, hostPort)),
        dependencies: sortRecord(collectDependencies(hostPlan).dependencies),
        devDependencies: sortRecord(collectDependencies(hostPlan).devDependencies),
      }),
    ),
  );
  if (usesTypeScript(hostPlan)) {
    files.push(makeFile("apps/host/tsconfig.json", localTsConfig(hostPlan)));
  }
  files.push(...prefixFiles("apps/host", testingFiles(hostPlan)));
  files.push(
    ...prefixFiles(
      "apps/host",
      microfrontendHostFiles(
        hostPlan,
        workspacePlan.workspace.remoteApps,
        hostPort,
        {
        badge: "Microfrontend host",
        heading: `${toTitleCase(workspacePlan.projectName)} Host`,
        lead: `${workspacePlan.metadata.description} This host app is ready to orchestrate shared navigation and remote composition.`,
        extraDetails: [
          { label: "Role", value: "Host app" },
          {
            label: "Strategy",
            value: toTitleCase(workspacePlan.workspace.microfrontendStrategy ?? "vite-federation"),
          },
          {
            label: "Remotes",
            value: workspacePlan.workspace.remoteApps.join(", "),
          },
        ],
      },
      ),
    ),
  );

  for (const [remoteIndex, remoteApp] of workspacePlan.workspace.remoteApps.entries()) {
    const remotePort = microfrontendPort(remoteIndex + 1);
    const remotePlan = {
      ...hostPlan,
      projectName: `${workspacePlan.projectName}-${remoteApp}`,
    };

    files.push(
      makeFile(
        `apps/remote-${remoteApp}/package.json`,
        stringifyJson({
          name: `${workspacePlan.projectName}-${remoteApp}`,
          version: generatedProjectVersion(),
          private: true,
          type: "module",
          packageManager: packageManagerField(packageManagerMetadata),
          pnpm: pnpmPackageConfig(remotePlan),
          scripts: sortRecord(microfrontendRemoteScripts(remotePlan, remotePort)),
          dependencies: sortRecord(collectDependencies(remotePlan).dependencies),
          devDependencies: sortRecord(collectDependencies(remotePlan).devDependencies),
        }),
      ),
    );

    if (usesTypeScript(remotePlan)) {
      files.push(
        makeFile(
          `apps/remote-${remoteApp}/tsconfig.json`,
          localTsConfig(remotePlan),
        ),
      );
    }
    files.push(...prefixFiles(`apps/remote-${remoteApp}`, testingFiles(remotePlan)));
    files.push(
      ...prefixFiles(
        `apps/remote-${remoteApp}`,
        microfrontendRemoteFiles(remotePlan, remoteApp, remotePort, {
          badge: "Microfrontend remote",
          heading: `${toTitleCase(remoteApp)} Remote`,
          lead: `${workspacePlan.metadata.description} This remote is ready to expose features back to the host application.`,
          extraDetails: [
            { label: "Role", value: "Remote app" },
            { label: "Remote key", value: remoteApp },
            { label: "Server", value: `http://127.0.0.1:${remotePort}` },
            {
              label: "Strategy",
              value: toTitleCase(workspacePlan.workspace.microfrontendStrategy ?? "vite-federation"),
            },
          ],
        }),
      ),
    );
  }

  return files;
}

function singlePackageFiles(
  plan: ProjectPlan,
  packageManagerMetadata: PackageManagerMetadata,
): GeneratedFile[] {
  const files: GeneratedFile[] = [
    singlePackageJson(plan, packageManagerMetadata),
    makeFile(".gitignore", rootGitignore()),
    ...docsFiles(plan),
    ...toolingFiles(plan),
  ];

  if (shouldGenerateNodeVersionFile(plan)) {
    files.push(makeFile(".nvmrc", `${nodeVersionSpec(plan)}\n`));
  }

  if (plan.metadata.generateEnvExample) {
    files.push(makeFile(".env.example", envExample(plan)));
  }

  switch (plan.intent) {
    case "landing-page":
    case "frontend-app":
      if (plan.frontend) {
        files.push(...frontendFiles(plan));
      }
      break;
    case "backend-api":
      files.push(...backendFiles(plan));
      break;
    case "fullstack-app":
      if (plan.frontend) {
        files.push(...frontendFiles(plan));
      }
      files.push(...fullstackExtras(plan));
      break;
    case "chrome-extension":
      files.push(...chromeExtensionFiles(plan));
      break;
    case "cli-tool":
      files.push(...cliToolFiles(plan));
      break;
    default:
      break;
  }

  return files;
}

export function buildProjectFiles(
  plan: ProjectPlan,
  environment: EnvironmentInfo,
): GeneratedFile[] {
  const packageManagerMetadata = resolvePackageManagerMetadata(plan.packageManager, environment);

  if (plan.architecture === "microfrontend") {
    return microfrontendFiles(plan, packageManagerMetadata);
  }

  if (plan.architecture === "monorepo") {
    return workspaceFiles(plan, packageManagerMetadata);
  }

  return singlePackageFiles(plan, packageManagerMetadata);
}
