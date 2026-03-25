import { spawnSync } from "node:child_process";
import type { EnvironmentInfo, InstallResult, ProjectPlan } from "../types.js";

function runCommand(command: string, args: string[], cwd: string): boolean {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "ignore",
    encoding: "utf8",
  });

  return result.status === 0;
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

export function runInstallers(
  plan: ProjectPlan,
  environment: EnvironmentInfo,
  skipInstall: boolean,
): InstallResult {
  const executed: string[] = [];
  const skipped: string[] = [];

  if (!skipInstall) {
    const managerStatus = environment.packageManagers[plan.packageManager];

    if (!managerStatus.installed) {
      skipped.push(
        `${plan.packageManager} is not installed; generated project without installing dependencies.`,
      );
    } else if (runCommand(plan.packageManager, installArgs(plan.packageManager), plan.targetDir)) {
      executed.push(`${plan.packageManager} install`);
    } else {
      skipped.push(`${plan.packageManager} install failed; dependencies were not installed.`);
    }
  } else {
    skipped.push("Dependency installation skipped by flag.");
  }

  if (plan.git.initialize) {
    if (runCommand("git", ["init"], plan.targetDir)) {
      executed.push("git init");
    } else {
      skipped.push("git init failed.");
    }

    if (plan.git.addRemote && plan.git.remoteUrl) {
      if (runCommand("git", ["remote", "add", "origin", plan.git.remoteUrl], plan.targetDir)) {
        executed.push("git remote add origin");
      } else {
        skipped.push("git remote add origin failed.");
      }
    }
  }

  return { executed, skipped };
}
