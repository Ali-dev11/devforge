import { detectEnvironment } from "../engines/environment.js";
import { buildDoctorPreflightReport, printPreflightReport } from "../preflight.js";
import { banner, info, step, success, warn } from "../utils/logger.js";

export async function runDoctorCommand(): Promise<void> {
  const environment = detectEnvironment();
  const report = buildDoctorPreflightReport(environment);

  banner("DevForge Doctor");
  info(`Platform: ${environment.platform}/${environment.arch}`);
  info(`Node.js: ${environment.nodeVersion}`);
  step(`Package manager preference: ${environment.recommendedPackageManager}`);

  printPreflightReport(report, { showHealthy: true });

  if (report.hasBlockingIssues) {
    warn("Doctor found blocking issues that should be resolved before scaffolding.");
    process.exitCode = 1;
    return;
  }

  success("\nDoctor completed. Your machine-level setup looks workable for DevForge, with any optional follow-ups listed above.");
}
