import type { AdvisoryItem, EnvironmentInfo, PreflightReport, ProjectPlan } from "./types.js";
import {
  hasInstalledPlaywrightBrowsers,
  hasLocalSshPublicKey,
  hasSystemTool,
  platformScopedDockerInstallCommand,
  platformScopedGitInstallCommand,
  platformScopedNodeSetupCommand,
  platformScopedPackageManagerInstallCommand,
  platformScopedPlaywrightInstallCommand,
  platformScopedSshInstallCommand,
  platformScopedSshKeygenCommand,
  preferredNodeVersionForPlan,
} from "./remediation.js";
import {
  isNodeVersionSupportedForFrontendToolchains,
  isNodeVersionSupportedForPlan,
  minimumSupportedFrontendNodeVersionHint,
  minimumSupportedNodeVersionHint,
} from "./utils/node-compat.js";
import { info, step, warn } from "./utils/logger.js";

type BuildReportOptions = {
  homeDir?: string;
  processEnv?: NodeJS.ProcessEnv;
};

function printAdvisorySection(
  title: string,
  items: AdvisoryItem[],
  options?: { warnItems?: boolean },
): void {
  if (items.length === 0) {
    return;
  }

  info("");
  step(`${title}:`);

  for (const item of items) {
    const log = options?.warnItems ? warn : info;
    log(`  ${item.title}: ${item.detail}`);
    if (item.command) {
      info(`    ${item.command}`);
    }
  }
}

function printNextCommands(commands: string[]): void {
  if (commands.length === 0) {
    return;
  }

  info("");
  step("Next commands:");
  for (const command of commands) {
    info(`    ${command}`);
  }
}

function sortInstalledPackageManagers(environment: EnvironmentInfo): string[] {
  return Object.entries(environment.packageManagers)
    .filter(([, status]) => status.installed)
    .map(([name, status]) => {
      const version = status.version ? ` ${status.version}` : "";
      return `${name}${version}`;
    });
}

function sshKeyReady(
  options?: BuildReportOptions,
): boolean {
  return hasLocalSshPublicKey(options?.homeDir);
}

export function buildDoctorPreflightReport(
  environment: EnvironmentInfo,
  options?: BuildReportOptions,
): PreflightReport {
  const healthy: AdvisoryItem[] = [];
  const requiredBeforeRun: AdvisoryItem[] = [];
  const recommended: AdvisoryItem[] = [];

  if (isNodeVersionSupportedForFrontendToolchains(environment.nodeVersion)) {
    healthy.push({
      title: "Node.js is ready for frontend and extension scaffolds",
      detail: `Current Node.js ${environment.nodeVersion} satisfies the browser-oriented toolchain floor used by DevForge-generated Vite-family and extension stacks.`,
    });
  } else {
    recommended.push({
      title: "Upgrade Node.js for frontend and extension scaffolds",
      detail: `Current Node.js ${environment.nodeVersion} can run DevForge itself, but frontend and browser-extension scaffolds need ${minimumSupportedFrontendNodeVersionHint()}.`,
      command: platformScopedNodeSetupCommand(environment, "22.12.0"),
    });
  }

  const installedPackageManagers = sortInstalledPackageManagers(environment);
  healthy.push({
    title: "Detected package managers",
    detail:
      installedPackageManagers.length > 0
        ? installedPackageManagers.join(", ")
        : "No supported package managers were detected.",
  });

  if (hasSystemTool(environment, "corepack")) {
    healthy.push({
      title: "Corepack is available",
      detail: "pnpm and Yarn scaffolds can be bootstrapped through Corepack on this machine.",
    });
  } else {
    recommended.push({
      title: "Enable Corepack for pnpm and Yarn flows",
      detail: "Corepack lets DevForge activate the selected package manager version without requiring a global pnpm or Yarn install.",
      command: "corepack enable",
    });
  }

  if (environment.packageManagers.bun.installed) {
    healthy.push({
      title: "Bun is installed",
      detail: `Detected Bun ${environment.packageManagers.bun.version ?? ""}`.trim(),
    });
  } else {
    recommended.push({
      title: "Install Bun for Bun-based scaffolds",
      detail: "DevForge can generate Bun projects, but Bun is not currently available in your shell.",
      command: platformScopedPackageManagerInstallCommand("bun", environment),
    });
  }

  if (hasSystemTool(environment, "git")) {
    healthy.push({
      title: "Git is available",
      detail: "Git initialization, remotes, and hook tooling can be used immediately.",
    });
  } else {
    recommended.push({
      title: "Install Git",
      detail: "Many generated projects initialize a repository or assume Git is available for day-one workflows.",
      command: platformScopedGitInstallCommand(environment.platform),
    });
  }

  if (hasSystemTool(environment, "docker")) {
    healthy.push({
      title: "Docker is available",
      detail: "Container-ready scaffolds can run without extra system setup.",
    });
  } else {
    recommended.push({
      title: "Install Docker for container workflows",
      detail: "Docker is optional in DevForge, but required if you choose containerized scaffolds or generated Docker assets.",
      command: platformScopedDockerInstallCommand(environment.platform),
    });
  }

  if (hasSystemTool(environment, "ssh")) {
    healthy.push({
      title: "SSH client is available",
      detail: "SSH-based Git remotes can be used on this machine.",
    });
  } else {
    recommended.push({
      title: "Install an SSH client",
      detail: "SSH is needed if you plan to use SSH remotes or generate SSH setup guidance.",
      command: platformScopedSshInstallCommand(environment.platform),
    });
  }

  if (sshKeyReady(options)) {
    healthy.push({
      title: "An SSH public key is present",
      detail: "You can attach the existing SSH key to GitHub or another Git provider if needed.",
    });
  } else {
    recommended.push({
      title: "Generate an SSH key before using SSH remotes",
      detail: "No local SSH public key was found under `~/.ssh`, so SSH-based Git remotes will need one-time setup first.",
      command: platformScopedSshKeygenCommand(),
    });
  }

  if (hasInstalledPlaywrightBrowsers(environment.platform, options?.processEnv, options?.homeDir)) {
    healthy.push({
      title: "Playwright browsers are installed",
      detail: "Browser E2E scaffolds can run Playwright tests without the extra browser-download step.",
    });
  } else {
    recommended.push({
      title: "Install Playwright browsers before browser E2E runs",
      detail: "The Playwright package can be installed through npm, pnpm, yarn, or bun, but browser binaries still need a one-time machine-level install.",
      command: platformScopedPlaywrightInstallCommand(environment.platform),
    });
  }

  return {
    title: "Doctor checks",
    healthy,
    requiredBeforeRun,
    recommended,
    nextCommands: [],
    hasBlockingIssues: false,
  };
}

export function buildPlanPreflightReport(
  plan: ProjectPlan,
  environment: EnvironmentInfo,
  options?: BuildReportOptions,
): PreflightReport {
  const healthy: AdvisoryItem[] = [];
  const requiredBeforeRun: AdvisoryItem[] = [];
  const recommended: AdvisoryItem[] = [];
  let hasBlockingIssues = false;

  const currentNodeSupported = isNodeVersionSupportedForPlan(plan, environment.nodeVersion);
  if (currentNodeSupported) {
    healthy.push({
      title: "Current Node.js version is compatible",
      detail: `${environment.nodeVersion} satisfies this scaffold's runtime floor.`,
    });
  } else {
    hasBlockingIssues = true;
    requiredBeforeRun.push({
      title: "Use a compatible Node.js version",
      detail: `Your shell is currently using ${environment.nodeVersion}, but this scaffold requires Node.js ${minimumSupportedNodeVersionHint(plan)} before dependency installation or run commands will work reliably.`,
      command: platformScopedNodeSetupCommand(environment, preferredNodeVersionForPlan(plan)),
    });
  }

  if (
    plan.nodeStrategy === "custom" &&
    plan.customNodeVersion &&
    currentNodeSupported &&
    !environment.nodeVersion.toLowerCase().includes(plan.customNodeVersion.toLowerCase())
  ) {
    requiredBeforeRun.push({
      title: "Switch to the selected custom Node.js version",
      detail: `This scaffold was configured for Node.js ${plan.customNodeVersion}, but your shell is currently using ${environment.nodeVersion}.`,
      command: platformScopedNodeSetupCommand(environment, plan.customNodeVersion),
    });
  }

  if (environment.packageManagers[plan.packageManager].installed) {
    healthy.push({
      title: `${plan.packageManager} is available`,
      detail: `DevForge can install and run the generated ${plan.packageManager} scripts on this machine.`,
    });
  } else {
    hasBlockingIssues = true;
    requiredBeforeRun.push({
      title: `Install or enable ${plan.packageManager}`,
      detail: `${plan.packageManager} was selected for this scaffold, but it is not currently available in your shell.`,
      command: platformScopedPackageManagerInstallCommand(plan.packageManager, environment),
    });
  }

  if (plan.testing.enabled && plan.testing.runner === "playwright") {
    if (hasInstalledPlaywrightBrowsers(environment.platform, options?.processEnv, options?.homeDir)) {
      healthy.push({
        title: "Playwright browsers are already installed",
        detail: "Browser E2E tests can run without extra machine-level setup.",
      });
    } else {
      recommended.push({
        title: "Install Playwright browsers",
        detail: "This scaffold includes Playwright, and browser binaries still need a one-time install on each machine that runs the E2E tests.",
        command: platformScopedPlaywrightInstallCommand(environment.platform),
      });
    }
  }

  if (plan.git.initialize || plan.git.addRemote || plan.tooling.husky) {
    if (hasSystemTool(environment, "git")) {
      healthy.push({
        title: "Git is available for the requested repository tooling",
        detail: "Repository initialization, hooks, and remote commands can run locally.",
      });
    } else {
      recommended.push({
        title: "Install Git",
        detail: "This scaffold enables Git-oriented workflows, but Git is not currently available in your shell.",
        command: platformScopedGitInstallCommand(environment.platform),
      });
    }
  }

  if (plan.tooling.docker) {
    if (hasSystemTool(environment, "docker")) {
      healthy.push({
        title: "Docker is available for the generated container assets",
        detail: "Container workflows can run locally without extra setup.",
      });
    } else {
      recommended.push({
        title: "Install Docker",
        detail: "Docker support was selected for this scaffold, but Docker is not currently available in your shell.",
        command: platformScopedDockerInstallCommand(environment.platform),
      });
    }
  }

  if (plan.git.setupSsh) {
    if (hasSystemTool(environment, "ssh")) {
      healthy.push({
        title: "SSH client is available",
        detail: "SSH-based remote setup can be completed locally.",
      });
    } else {
      recommended.push({
        title: "Install an SSH client",
        detail: "SSH setup guidance was requested for this scaffold, but `ssh` is not currently available in your shell.",
        command: platformScopedSshInstallCommand(environment.platform),
      });
    }

    if (sshKeyReady(options)) {
      healthy.push({
        title: "A local SSH public key is present",
        detail: "You can attach the existing key to your Git provider when connecting the generated repository.",
      });
    } else {
      recommended.push({
        title: "Generate an SSH key",
        detail: "No local SSH public key was found under `~/.ssh`, so SSH remote setup will need a one-time key generation step.",
        command: platformScopedSshKeygenCommand(),
      });
    }
  }

  return {
    title: "Preflight checks",
    healthy,
    requiredBeforeRun,
    recommended,
    nextCommands: [],
    hasBlockingIssues,
  };
}

export function hasVisiblePreflightOutput(
  report: PreflightReport,
  options?: { showHealthy?: boolean },
): boolean {
  return (
    report.requiredBeforeRun.length > 0 ||
    report.recommended.length > 0 ||
    report.nextCommands.length > 0 ||
    Boolean(options?.showHealthy && report.healthy.length > 0)
  );
}

export function printPreflightReport(
  report: PreflightReport,
  options?: { showHealthy?: boolean },
): void {
  if (!hasVisiblePreflightOutput(report, options)) {
    return;
  }

  info("");
  step(report.title);
  printAdvisorySection("Required before run", report.requiredBeforeRun, {
    warnItems: true,
  });
  printAdvisorySection("Recommended", report.recommended);

  if (options?.showHealthy) {
    printAdvisorySection("Healthy", report.healthy);
  }

  printNextCommands(report.nextCommands);
}
