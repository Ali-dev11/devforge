import type { ProjectPlan } from "../types.js";

type ParsedNodeVersion = {
  major: number;
  minor: number;
  patch: number;
};

function parseNodeVersionPart(value: string | undefined): number {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseNodeVersion(value: string | undefined): ParsedNodeVersion | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.trim().match(/v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) {
    return undefined;
  }

  return {
    major: parseNodeVersionPart(match[1]),
    minor: parseNodeVersionPart(match[2]),
    patch: parseNodeVersionPart(match[3]),
  };
}

export function compareNodeVersions(
  left: ParsedNodeVersion,
  right: ParsedNodeVersion,
): number {
  if (left.major !== right.major) {
    return left.major - right.major;
  }

  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }

  return left.patch - right.patch;
}

function requiresElevatedFrontendNode(plan: ProjectPlan): boolean {
  return Boolean(plan.frontend) || plan.intent === "chrome-extension";
}

export function minimumSupportedFrontendNodeVersionHint(): string {
  return "20.19.0 or 22.12.0+";
}

export function isNodeVersionSupportedForFrontendToolchains(
  value: string | undefined,
): boolean {
  const parsed = parseNodeVersion(value);
  if (!parsed) {
    return true;
  }

  const minimumNode20: ParsedNodeVersion = { major: 20, minor: 19, patch: 0 };
  const minimumNode22: ParsedNodeVersion = { major: 22, minor: 12, patch: 0 };

  if (parsed.major === 20) {
    return compareNodeVersions(parsed, minimumNode20) >= 0;
  }

  if (parsed.major === 22) {
    return compareNodeVersions(parsed, minimumNode22) >= 0;
  }

  return parsed.major > 22;
}

export function generatedProjectNodeEngine(plan: ProjectPlan): string {
  return requiresElevatedFrontendNode(plan) ? ">=20.19.0 || >=22.12.0" : ">=20.0.0";
}

export function minimumSupportedNodeVersionHint(plan: ProjectPlan): string {
  return requiresElevatedFrontendNode(plan)
    ? minimumSupportedFrontendNodeVersionHint()
    : "20.0.0";
}

export function isNodeVersionSupportedForPlan(
  plan: ProjectPlan,
  value: string | undefined,
): boolean {
  const parsed = parseNodeVersion(value);
  if (!parsed) {
    return true;
  }

  if (!requiresElevatedFrontendNode(plan)) {
    return parsed.major > 20 || (parsed.major === 20 && parsed.minor >= 0);
  }

  return isNodeVersionSupportedForFrontendToolchains(value);
}
