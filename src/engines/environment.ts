import os from "node:os";
import { spawnSync } from "node:child_process";
import type { BinaryStatus, EnvironmentInfo, PackageManager } from "../types.js";

function readCommandOutput(command: string, args: string[]): string | undefined {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    return undefined;
  }

  const output = `${result.stdout}${result.stderr}`.trim();
  return output || undefined;
}

function resolveBinaryPath(binary: string): string | undefined {
  const locator = process.platform === "win32" ? "where" : "which";
  return readCommandOutput(locator, [binary])?.split(/\r?\n/)[0];
}

function detectBinary(binary: string, versionArgs: string[] = ["--version"]): BinaryStatus {
  const path = resolveBinaryPath(binary);

  if (!path) {
    return { installed: false };
  }

  const version = readCommandOutput(binary, versionArgs)?.split(/\r?\n/)[0];
  return { installed: true, path, version };
}

function selectRecommendedPackageManager(statuses: Record<PackageManager, BinaryStatus>): PackageManager {
  if (statuses.pnpm.installed) {
    return "pnpm";
  }

  if (statuses.bun.installed) {
    return "bun";
  }

  if (statuses.yarn.installed) {
    return "yarn";
  }

  return "npm";
}

export function detectEnvironment(): EnvironmentInfo {
  const packageManagers: Record<PackageManager, BinaryStatus> = {
    npm: detectBinary("npm", ["-v"]),
    pnpm: detectBinary("pnpm", ["-v"]),
    yarn: detectBinary("yarn", ["-v"]),
    bun: detectBinary("bun", ["-v"]),
  };

  return {
    platform: process.platform,
    arch: os.arch(),
    nodeVersion: process.version,
    packageManagers,
    recommendedPackageManager: selectRecommendedPackageManager(packageManagers),
    systemTools: {
      git: detectBinary("git", ["--version"]),
      docker: detectBinary("docker", ["--version"]),
      corepack: detectBinary("corepack", ["--version"]),
      fnm: detectBinary("fnm", ["--version"]),
    },
  };
}
