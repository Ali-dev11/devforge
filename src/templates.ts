import type {
  BackendFramework,
  EnvironmentInfo,
  FrontendFramework,
  GeneratedFile,
  NestAdapter,
  PackageManager,
  ProjectPlan,
} from "./types.js";
import { joinSentence, toConstantCase, toTitleCase } from "./utils/strings.js";

type PackageJsonShape = {
  name: string;
  version: string;
  private?: boolean;
  type?: "module";
  scripts?: Record<string, string>;
  workspaces?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
};

function stringifyJson(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function makeFile(path: string, content: string, executable = false): GeneratedFile {
  return { path, content, executable };
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

function nodeVersionSpec(plan: ProjectPlan): string {
  if (plan.nodeStrategy === "custom" && plan.customNodeVersion) {
    return plan.customNodeVersion;
  }

  if (plan.nodeStrategy === "latest") {
    return "node";
  }

  return "lts/*";
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

function rootTsConfig(): string {
  return stringifyJson({
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      skipLibCheck: true,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      outDir: "dist",
      rootDir: ".",
      jsx: "react-jsx",
    },
    include: ["src", "app", "apps", "packages"],
  });
}

function localTsConfig(include: string[] = ["src", "app", "tests", "cypress"]): string {
  return stringifyJson({
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      skipLibCheck: true,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      outDir: "dist",
      rootDir: ".",
      jsx: "react-jsx",
    },
    include,
  });
}

function generatedProjectVersion(): string {
  return "0.1.0";
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
    "```",
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
    "```",
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
      addRecord(devDependencies, {
        autoprefixer: "latest",
        postcss: "latest",
        tailwindcss: "latest",
      });
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
          "dev:api": usesTypeScript(plan)
            ? "tsx watch src/server.ts"
            : "node --watch src/server.js",
          build: `${packageManagerRunCommand(plan.packageManager, "build:web")} && ${packageManagerRunCommand(plan.packageManager, "build:api")}`,
          "build:web": "vite build",
          "build:api": usesTypeScript(plan)
            ? "tsc -p tsconfig.json"
            : "echo \"JavaScript API does not require compilation\"",
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

function singlePackageJson(plan: ProjectPlan): GeneratedFile {
  const { dependencies, devDependencies } = collectDependencies(plan);
  const data: PackageJsonShape = {
    name: plan.projectName,
    version: generatedProjectVersion(),
    private: true,
    type: "module",
    scripts: sortRecord(singlePackageScripts(plan)),
    engines: {
      node: ">=20.0.0",
    },
    dependencies: sortRecord(dependencies),
    devDependencies: sortRecord(devDependencies),
  };

  return makeFile("package.json", stringifyJson(data));
}

function styleFileContent(plan: ProjectPlan): string {
  if (plan.frontend?.styling === "tailwind-css") {
    return ["@tailwind base;", "@tailwind components;", "@tailwind utilities;", ""].join("\n");
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

function reactAppSource(plan: ProjectPlan): GeneratedFile[] {
  const frontend = plan.frontend;
  const styleImport =
    frontend?.styling === "scss" ? "./styles.scss" : "./styles.css";

  const files: GeneratedFile[] = [
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
        "",
        "export default defineConfig({",
        "  plugins: [react()],",
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
        "export default function App() {",
        "  return (",
        "    <main style={{ padding: \"4rem 1.5rem\", maxWidth: 960, margin: \"0 auto\" }}>",
        `      <p style={{ letterSpacing: "0.2em", textTransform: "uppercase" }}>DevForge starter</p>`,
        `      <h1>${toTitleCase(plan.projectName)}</h1>`,
        "      <p>",
        `        ${plan.metadata.description}`,
        "      </p>",
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

  return files;
}

function nextJsSource(plan: ProjectPlan): GeneratedFile[] {
  return [
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
        "export default function HomePage() {",
        "  return (",
        "    <main style={{ padding: \"4rem 1.5rem\", maxWidth: 960, margin: \"0 auto\" }}>",
        `      <p style={{ textTransform: "uppercase", letterSpacing: "0.2em" }}>DevForge generated</p>`,
        `      <h1>${toTitleCase(plan.projectName)}</h1>`,
        `      <p>${plan.metadata.description}</p>`,
        "    </main>",
        "  );",
        "}",
        "",
      ].join("\n"),
    ),
    makeFile("app/globals.css", styleFileContent(plan)),
  ];
}

function astroSource(plan: ProjectPlan): GeneratedFile[] {
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
        `const title = "${toTitleCase(plan.projectName)}";`,
        "---",
        "",
        "<html lang=\"en\">",
        "  <head>",
        "    <meta charset=\"utf-8\" />",
        "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
        "    <title>{title}</title>",
        "  </head>",
        "  <body>",
        `    <main><h1>{title}</h1><p>${plan.metadata.description}</p></main>`,
        "  </body>",
        "</html>",
        "",
      ].join("\n"),
    ),
  ];
}

function vueSource(plan: ProjectPlan): GeneratedFile[] {
  return [
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
        "",
        "export default defineConfig({",
        "  plugins: [vue()],",
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
        `    <h1>${toTitleCase(plan.projectName)}</h1>`,
        `    <p>${plan.metadata.description}</p>`,
        "  </main>",
        "</template>",
        "",
        "<style scoped>",
        ".shell { padding: 4rem 1.5rem; max-width: 960px; margin: 0 auto; }",
        "</style>",
        "",
      ].join("\n"),
    ),
  ];
}

function nuxtSource(plan: ProjectPlan): GeneratedFile[] {
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
        "  <main style=\"padding: 4rem 1.5rem; max-width: 960px; margin: 0 auto;\">",
        `    <h1>${toTitleCase(plan.projectName)}</h1>`,
        `    <p>${plan.metadata.description}</p>`,
        "  </main>",
        "</template>",
        "",
      ].join("\n"),
    ),
  ];
}

function svelteSource(plan: ProjectPlan): GeneratedFile[] {
  return [
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
        "",
        "export default defineConfig({",
        "  plugins: [svelte()],",
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
        `  const description = "${plan.metadata.description}";`,
        "</script>",
        "",
        `<svelte:head><title>${toTitleCase(plan.projectName)}</title></svelte:head>`,
        "",
        `<main style="padding: 4rem 1.5rem; max-width: 960px; margin: 0 auto;">`,
        `  <h1>${toTitleCase(plan.projectName)}</h1>`,
        "  <p>{description}</p>",
        "</main>",
        "",
      ].join("\n"),
    ),
  ];
}

function svelteKitSource(plan: ProjectPlan): GeneratedFile[] {
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
        `<svelte:head><title>${toTitleCase(plan.projectName)}</title></svelte:head>`,
        "",
        `<main style="padding: 4rem 1.5rem; max-width: 960px; margin: 0 auto;">`,
        `  <h1>${toTitleCase(plan.projectName)}</h1>`,
        `  <p>${plan.metadata.description}</p>`,
        "</main>",
        "",
      ].join("\n"),
    ),
  ];
}

function solidSource(plan: ProjectPlan): GeneratedFile[] {
  return [
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
        "",
        "export default defineConfig({",
        "  plugins: [solid()],",
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
        "export default function App() {",
        "  return (",
        "    <main style={{ padding: \"4rem 1.5rem\", maxWidth: \"960px\", margin: \"0 auto\" }}>",
        `      <h1>${toTitleCase(plan.projectName)}</h1>`,
        `      <p>${plan.metadata.description}</p>`,
        "    </main>",
        "  );",
        "}",
        "",
      ].join("\n"),
    ),
  ];
}

function angularSource(plan: ProjectPlan): GeneratedFile[] {
  return [
    makeFile(
      "src/main.ts",
      [
        "import { bootstrapApplication } from \"@angular/platform-browser\";",
        "import { Component } from \"@angular/core\";",
        "",
        "@Component({",
        "  selector: \"app-root\",",
        "  standalone: true,",
        `  template: \`<main style="padding:4rem 1.5rem;max-width:960px;margin:0 auto"><h1>${toTitleCase(plan.projectName)}</h1><p>${plan.metadata.description}</p></main>\`,`,
        "})",
        "class AppComponent {}",
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

function remixSource(plan: ProjectPlan): GeneratedFile[] {
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
        "export default function IndexRoute() {",
        "  return (",
        "    <main style={{ padding: \"4rem 1.5rem\", maxWidth: 960, margin: \"0 auto\" }}>",
        `      <h1>${toTitleCase(plan.projectName)}</h1>`,
        `      <p>${plan.metadata.description}</p>`,
        "    </main>",
        "  );",
        "}",
        "",
      ].join("\n"),
    ),
  ];
}

function frontendFiles(plan: ProjectPlan): GeneratedFile[] {
  switch (plan.frontend?.framework) {
    case "nextjs":
      return nextJsSource(plan);
    case "astro":
      return astroSource(plan);
    case "nuxt":
      return nuxtSource(plan);
    case "vue-vite":
      return vueSource(plan);
    case "svelte":
      return svelteSource(plan);
    case "sveltekit":
      return svelteKitSource(plan);
    case "solidjs":
      return solidSource(plan);
    case "angular":
      return angularSource(plan);
    case "remix":
      return remixSource(plan);
    case "react-vite":
    default:
      return reactAppSource(plan);
  }
}

function backendServerSource(plan: ProjectPlan): string {
  const framework = plan.backend?.framework ?? "hono";

  switch (framework) {
    case "express":
      return [
        "import express from \"express\";",
        "import cors from \"cors\";",
        "",
        "const app = express();",
        "app.use(cors());",
        "app.get(\"/health\", (_req, res) => res.json({ ok: true }));",
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
        "const app = Fastify();",
        "app.get(\"/health\", async () => ({ ok: true }));",
        "",
        "const port = Number(process.env.PORT ?? 3001);",
        "app.listen({ port });",
        "",
      ].join("\n");
    case "koa":
      return [
        "import Koa from \"koa\";",
        "",
        "const app = new Koa();",
        "app.use(async (ctx) => {",
        "  if (ctx.path === \"/health\") {",
        "    ctx.body = { ok: true };",
        "    return;",
        "  }",
        "",
        "  ctx.body = { status: \"ready\" };",
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
        "@Controller()",
        "class AppController {",
        "  @Get(\"health\")",
        "  health() {",
        "    return { ok: true };",
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
        "const app = new Hono();",
        "app.get(\"/health\", (c) => c.json({ ok: true }));",
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
  return [
    makeFile(
      "src/index.ts",
      [
        "#!/usr/bin/env node",
        "",
        "const args = process.argv.slice(2);",
        "",
        "if (args.includes(\"--help\")) {",
        `  console.log("Usage: ${plan.projectName} [command]");`,
        "} else {",
        `  console.log("${toTitleCase(plan.projectName)} is ready.");`,
        "}",
        "",
      ].join("\n"),
      true,
    ),
  ];
}

function chromeExtensionFiles(plan: ProjectPlan): GeneratedFile[] {
  const files: GeneratedFile[] = [
    makeFile(
      "manifest.json",
      stringifyJson({
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
              service_worker: "src/background.ts",
            }
          : undefined,
        content_scripts: plan.extension?.includesContent
          ? [
              {
                matches: ["<all_urls>"],
                js: ["src/content.ts"],
              },
            ]
          : undefined,
      }),
    ),
  ];

  if (plan.extension?.includesBackground) {
    files.push(
      makeFile(
        "src/background.ts",
        [
          "chrome.runtime.onInstalled.addListener(() => {",
          "  console.log(\"Extension installed\");",
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
          "console.log(\"DevForge content script ready\");",
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
              "function Popup() {",
              "  return (",
              "    <main style={{ minWidth: 320, padding: 16 }}>",
              `      <h1>${toTitleCase(plan.projectName)}</h1>`,
              "      <p>Popup scaffold generated by DevForge.</p>",
              "    </main>",
              "  );",
              "}",
              "",
              "ReactDOM.createRoot(document.getElementById(\"root\")!).render(<Popup />);",
              "",
            ].join("\n")
          : [
              "const root = document.getElementById(\"root\");",
              `if (root) root.innerHTML = "<main style='min-width:320px;padding:16px'><h1>${toTitleCase(plan.projectName)}</h1><p>Popup scaffold generated by DevForge.</p></main>";`,
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
    "      - uses: actions/checkout@v4",
  ];

  if (plan.packageManager === "bun") {
    lines.push(
      "      - uses: oven-sh/setup-bun@v2",
      "        with:",
      "          bun-version: latest",
    );
  } else {
    lines.push(
      "      - uses: actions/setup-node@v4",
      "        with:",
      "          node-version: 22",
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
    files.push(makeFile("tsconfig.json", rootTsConfig()));
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
    return [
      makeFile(
        "app/api/health/route.ts",
        [
          "export async function GET() {",
          "  return Response.json({ ok: true });",
          "}",
          "",
        ].join("\n"),
      ),
    ];
  }

  return backendFiles(plan);
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
    workspaces: ["apps/*", "packages/*"],
    scripts: sortRecord(appendQualityScripts(plan, scripts)),
    engines: {
      node: ">=20.0.0",
    },
    devDependencies: sortRecord(devDependencies),
  };

  return makeFile("package.json", stringifyJson(data));
}

function workspaceFiles(plan: ProjectPlan): GeneratedFile[] {
  const tool = plan.workspace.tool ?? "turborepo";
  const files: GeneratedFile[] = [
    workspaceRootPackageJson(plan, tool),
    makeFile(".gitignore", rootGitignore()),
    makeFile(".nvmrc", `${nodeVersionSpec(plan)}\n`),
    ...docsFiles(plan),
    ...toolingFiles(plan, { includeTesting: false }),
  ];

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

  if (plan.frontend) {
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
          scripts: sortRecord(singlePackageScripts(webPlan)),
          dependencies: sortRecord(collectDependencies(webPlan).dependencies),
          devDependencies: sortRecord(collectDependencies(webPlan).devDependencies),
        }),
      ),
    );
    if (usesTypeScript(webPlan)) {
      files.push(makeFile("apps/web/tsconfig.json", localTsConfig()));
    }
    files.push(...prefixFiles("apps/web", testingFiles(webPlan)));
    files.push(...prefixFiles("apps/web", frontendFiles(webPlan)));
  }

  if (plan.backend) {
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
          scripts: sortRecord(singlePackageScripts(apiPlan)),
          dependencies: sortRecord(collectDependencies(apiPlan).dependencies),
          devDependencies: sortRecord(collectDependencies(apiPlan).devDependencies),
        }),
      ),
    );
    if (usesTypeScript(apiPlan)) {
      files.push(makeFile("apps/api/tsconfig.json", localTsConfig(["src", "tests", "cypress"])));
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

function microfrontendFiles(plan: ProjectPlan): GeneratedFile[] {
  const workspacePlan: ProjectPlan = {
    ...plan,
    architecture: "microfrontend",
    workspace: {
      ...plan.workspace,
      tool: "turborepo",
      remoteApps: plan.workspace.remoteApps.length > 0 ? plan.workspace.remoteApps : ["catalog", "dashboard"],
    },
  };

  const files = workspaceFiles(workspacePlan);
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
    architecture: "simple",
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
        scripts: sortRecord(singlePackageScripts(hostPlan)),
        dependencies: sortRecord(collectDependencies(hostPlan).dependencies),
        devDependencies: sortRecord(collectDependencies(hostPlan).devDependencies),
      }),
    ),
  );
  if (usesTypeScript(hostPlan)) {
    files.push(makeFile("apps/host/tsconfig.json", localTsConfig()));
  }
  files.push(...prefixFiles("apps/host", testingFiles(hostPlan)));
  files.push(...prefixFiles("apps/host", frontendFiles(hostPlan)));

  for (const remoteApp of workspacePlan.workspace.remoteApps) {
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
          scripts: sortRecord(singlePackageScripts(remotePlan)),
          dependencies: sortRecord(collectDependencies(remotePlan).dependencies),
          devDependencies: sortRecord(collectDependencies(remotePlan).devDependencies),
        }),
      ),
    );

    if (usesTypeScript(remotePlan)) {
      files.push(makeFile(`apps/remote-${remoteApp}/tsconfig.json`, localTsConfig()));
    }
    files.push(...prefixFiles(`apps/remote-${remoteApp}`, testingFiles(remotePlan)));
    files.push(...prefixFiles(`apps/remote-${remoteApp}`, frontendFiles(remotePlan)));
  }

  return files;
}

function singlePackageFiles(plan: ProjectPlan): GeneratedFile[] {
  const files: GeneratedFile[] = [
    singlePackageJson(plan),
    makeFile(".gitignore", rootGitignore()),
    makeFile(".nvmrc", `${nodeVersionSpec(plan)}\n`),
    ...docsFiles(plan),
    ...toolingFiles(plan),
  ];

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
  _environment: EnvironmentInfo,
): GeneratedFile[] {
  if (plan.architecture === "microfrontend") {
    return microfrontendFiles(plan);
  }

  if (plan.architecture === "monorepo") {
    return workspaceFiles(plan);
  }

  return singlePackageFiles(plan);
}
