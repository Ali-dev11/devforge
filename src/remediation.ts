import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import type { EnvironmentInfo, PackageManager, ProjectPlan } from "./types.js";

export function hasFrontendLikeSurface(plan: ProjectPlan): boolean {
  return Boolean(plan.frontend) || plan.intent === "chrome-extension";
}

export function platformScopedPlaywrightInstallCommand(platform: NodeJS.Platform): string {
  return platform === "linux"
    ? "npx playwright install --with-deps"
    : "npx playwright install";
}

export function preferredNodeVersionForPlan(plan: ProjectPlan): string | undefined {
  if (plan.nodeStrategy === "custom" && plan.customNodeVersion) {
    return plan.customNodeVersion;
  }

  return hasFrontendLikeSurface(plan) ? "22.12.0" : "20.0.0";
}

export function hasSystemTool(
  environment: EnvironmentInfo,
  tool: keyof NonNullable<EnvironmentInfo["systemTools"]>,
): boolean {
  return environment.systemTools?.[tool]?.installed ?? false;
}

export function canUsePackageManager(
  environment: EnvironmentInfo,
  packageManager: PackageManager,
): boolean {
  if (environment.packageManagers[packageManager].installed) {
    return true;
  }

  return (packageManager === "pnpm" || packageManager === "yarn") && hasSystemTool(environment, "corepack");
}

export function platformScopedNodeSetupCommand(
  environment: EnvironmentInfo,
  targetNodeVersion: string | undefined,
): string | undefined {
  if (!targetNodeVersion) {
    return undefined;
  }

  if (hasSystemTool(environment, "fnm")) {
    return `fnm install ${targetNodeVersion} && fnm use ${targetNodeVersion}`;
  }

  if (environment.platform === "win32") {
    return `nvm install ${targetNodeVersion} && nvm use ${targetNodeVersion}`;
  }

  return `nvm install ${targetNodeVersion} && nvm use ${targetNodeVersion}`;
}

export function platformScopedGitInstallCommand(platform: NodeJS.Platform): string {
  switch (platform) {
    case "darwin":
      return "xcode-select --install";
    case "win32":
      return "winget install Git.Git";
    case "linux":
    default:
      return "sudo apt-get update && sudo apt-get install -y git";
  }
}

export function platformScopedDockerInstallCommand(platform: NodeJS.Platform): string {
  switch (platform) {
    case "darwin":
      return "brew install --cask docker";
    case "win32":
      return "winget install Docker.DockerDesktop";
    case "linux":
    default:
      return "curl -fsSL https://get.docker.com | sh";
  }
}

export function platformScopedSshInstallCommand(platform: NodeJS.Platform): string {
  switch (platform) {
    case "darwin":
      return "xcode-select --install";
    case "win32":
      return 'powershell -Command "Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0"';
    case "linux":
    default:
      return "sudo apt-get update && sudo apt-get install -y openssh-client";
  }
}

export function platformScopedSshKeygenCommand(email = "your-email@example.com"): string {
  return `ssh-keygen -t ed25519 -C "${email}"`;
}

export function platformScopedPackageManagerInstallCommand(
  packageManager: PackageManager,
  environment: EnvironmentInfo,
): string | undefined {
  switch (packageManager) {
    case "pnpm":
    case "yarn":
      return hasSystemTool(environment, "corepack")
        ? `corepack enable && corepack prepare ${packageManager}@latest --activate`
        : `npm install -g ${packageManager}`;
    case "bun":
      return environment.platform === "win32"
        ? 'powershell -c "irm bun.sh/install.ps1 | iex"'
        : "curl -fsSL https://bun.sh/install | bash";
    case "npm":
      switch (environment.platform) {
        case "darwin":
          return "brew install node";
        case "win32":
          return "winget install OpenJS.NodeJS.LTS";
        case "linux":
        default:
          return "nvm install --lts";
      }
    default:
      return undefined;
  }
}

function defaultPlaywrightCacheDir(platform: NodeJS.Platform, homeDir: string): string {
  switch (platform) {
    case "darwin":
      return join(homeDir, "Library", "Caches", "ms-playwright");
    case "win32":
      return join(homeDir, "AppData", "Local", "ms-playwright");
    case "linux":
    default:
      return join(homeDir, ".cache", "ms-playwright");
  }
}

export function hasInstalledPlaywrightBrowsers(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv = process.env,
  homeDir = os.homedir(),
): boolean {
  const configuredPath = env.PLAYWRIGHT_BROWSERS_PATH;
  const cacheDir =
    configuredPath && configuredPath !== "0"
      ? configuredPath
      : defaultPlaywrightCacheDir(platform, homeDir);

  if (!cacheDir || !existsSync(cacheDir)) {
    return false;
  }

  try {
    return readdirSync(cacheDir).some((entry) => !entry.startsWith("."));
  } catch {
    return false;
  }
}

export function hasLocalSshPublicKey(homeDir = os.homedir()): boolean {
  const sshDir = join(homeDir, ".ssh");
  if (!existsSync(sshDir)) {
    return false;
  }

  try {
    return readdirSync(sshDir).some((entry) => entry.endsWith(".pub"));
  } catch {
    return false;
  }
}
