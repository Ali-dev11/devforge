import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { EnvironmentInfo, InstallResult, ProjectPlan } from "../types.js";

type CommandResult = {
  ok: boolean;
  output?: string;
};

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  env?: Record<string, string>,
): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() || undefined;
  return {
    ok: result.status === 0,
    output,
  };
}

function installArgs(packageManager: ProjectPlan["packageManager"]): string[] {
  switch (packageManager) {
    case "pnpm":
      return ["install"];
    case "yarn":
      return ["install"];
    case "bun":
      return ["install"];
    case "npm":
    default:
      return ["install"];
  }
}

function hasCorepack(cwd: string): boolean {
  return runCommand("corepack", ["--version"], cwd).ok;
}

function installCacheEnv(
  packageManager: ProjectPlan["packageManager"],
  cwd: string,
): Record<string, string> {
  const devforgeDir = join(cwd, ".devforge");
  mkdirSync(devforgeDir, { recursive: true });

  const env: Record<string, string> = {};
  if (packageManager === "npm") {
    env.npm_config_cache = join(devforgeDir, "npm-cache");
  }

  if (packageManager === "pnpm") {
    env.COREPACK_HOME = join(devforgeDir, "corepack");
    env.PNPM_STORE_DIR = join(devforgeDir, "pnpm-store");
  }

  if (packageManager === "yarn") {
    env.COREPACK_HOME = join(devforgeDir, "corepack");
    env.YARN_CACHE_FOLDER = join(devforgeDir, "yarn-cache");
  }

  return env;
}

function installInvocation(
  packageManager: ProjectPlan["packageManager"],
  environment: EnvironmentInfo,
  cwd: string,
): { command: string; args: string[]; label: string; available: boolean; env?: Record<string, string> } {
  const env = installCacheEnv(packageManager, cwd);

  if ((packageManager === "pnpm" || packageManager === "yarn") && hasCorepack(cwd)) {
    return {
      command: "corepack",
      args: [packageManager, ...installArgs(packageManager)],
      label: `corepack ${packageManager} install`,
      available: true,
      env,
    };
  }

  return {
    command: packageManager,
    args: installArgs(packageManager),
    label: `${packageManager} install`,
    available: environment.packageManagers[packageManager].installed,
    env,
  };
}

function removeIncompatibleLockfiles(cwd: string, packageManager: ProjectPlan["packageManager"]): void {
  const lockfilesByManager: Record<ProjectPlan["packageManager"], string[]> = {
    npm: ["package-lock.json"],
    pnpm: ["pnpm-lock.yaml"],
    yarn: ["yarn.lock"],
    bun: ["bun.lock", "bun.lockb"],
  };
  const keep = new Set(lockfilesByManager[packageManager]);

  for (const filename of Object.values(lockfilesByManager).flat()) {
    if (keep.has(filename)) {
      continue;
    }

    const filePath = join(cwd, filename);
    if (existsSync(filePath)) {
      rmSync(filePath, { force: true });
    }
  }
}

export function runInstallers(
  plan: ProjectPlan,
  environment: EnvironmentInfo,
  skipInstall: boolean,
): InstallResult {
  const executed: string[] = [];
  const skipped: string[] = [];

  if (!skipInstall) {
    const invocation = installInvocation(plan.packageManager, environment, plan.targetDir);

    if (!invocation.available) {
      skipped.push(
        `${plan.packageManager} is not installed and Corepack is unavailable; generated project without installing dependencies.`,
      );
    } else {
      removeIncompatibleLockfiles(plan.targetDir, plan.packageManager);
      const installResult = runCommand(
        invocation.command,
        invocation.args,
        plan.targetDir,
        invocation.env,
      );

      if (installResult.ok) {
        executed.push(invocation.label);
      } else {
        skipped.push(
          installResult.output
            ? `${invocation.label} failed: ${installResult.output.split(/\r?\n/)[0]}`
            : `${invocation.label} failed; dependencies were not installed.`,
        );
      }
    }
  } else {
    skipped.push("Dependency installation skipped by flag.");
  }

  if (plan.git.initialize) {
    if (runCommand("git", ["init"], plan.targetDir).ok) {
      executed.push("git init");
    } else {
      skipped.push("git init failed.");
    }

    if (plan.git.addRemote && plan.git.remoteUrl) {
      if (runCommand("git", ["remote", "add", "origin", plan.git.remoteUrl], plan.targetDir).ok) {
        executed.push("git remote add origin");
      } else {
        skipped.push("git remote add origin failed.");
      }
    }
  }

  return { executed, skipped };
}
