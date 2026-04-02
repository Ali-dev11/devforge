import { selectDevforgeRuleReferences } from "../devforge-rules.js";
import type { GeneratedFile, ProjectPlan, RuleCategory } from "../types.js";
import { joinSentence, toTitleCase } from "../utils/strings.js";

function modePreamble(mode: ProjectPlan["ai"]["ruleMode"]): string {
  switch (mode) {
    case "minimal":
      return "Prefer small, low-risk changes and preserve framework defaults unless the task clearly calls for a stronger opinion.";
    case "strict":
      return "Enforce architectural boundaries, naming consistency, security hygiene, and test coverage before considering work complete.";
    case "balanced":
    default:
      return "Favor maintainable, production-ready code while keeping the developer experience fast and pragmatic.";
  }
}

function withManagedBanner(content: string): string {
  return `<!-- Managed by DevForge. Safe to refresh with devforge upgrade. -->\n\n${content}`;
}

function categorySection(category: RuleCategory, plan: ProjectPlan): string {
  switch (category) {
    case "core":
      return [
        "## Core Rules",
        "- Keep changes consistent with the selected stack and generated structure.",
        "- Prefer small modules, clear names, and predictable file ownership.",
        "- Document decisions that affect architecture, tooling, or deployment.",
      ].join("\n");
    case "frontend":
      return [
        "## Frontend Rules",
        `- Respect the selected frontend stack: ${plan.frontend?.framework ?? "n/a"}.`,
        `- Use the chosen styling approach: ${plan.frontend?.styling ?? "n/a"}.`,
        "- Maintain accessible UI, semantic markup, and resilient loading/error states.",
      ].join("\n");
    case "backend":
      return [
        "## Backend Rules",
        `- Use ${plan.backend?.framework ?? "the selected backend framework"} conventions for routing and composition.`,
        "- Validate external input at boundaries and centralize error handling.",
        "- Keep configuration and secrets out of source files.",
      ].join("\n");
    case "architecture":
      return [
        "## Architecture Rules",
        `- Preserve the selected architecture mode: ${plan.architecture}.`,
        "- Keep shared code in well-named modules and avoid circular dependencies.",
        "- Treat generated docs and config as the source of truth for project structure.",
      ].join("\n");
    case "security":
      return [
        "## Security Rules",
        "- Never commit secrets, tokens, or private keys.",
        "- Apply least-privilege defaults for auth, storage, and third-party integrations.",
        "- Sanitize environment access behind typed configuration helpers.",
      ].join("\n");
    case "testing":
      return [
        "## Testing Rules",
        "- Add unit tests for non-trivial logic and integration coverage for critical flows.",
        "- Cover auth, data access, and state transitions before shipping.",
        "- Keep tests deterministic and CI-friendly.",
      ].join("\n");
  }
}

function buildUnifiedRules(plan: ProjectPlan): string {
  const selectedCategories: RuleCategory[] = plan.ai.categories.length
    ? plan.ai.categories
    : ["core", "security", "testing"];
  const ruleReferences = selectDevforgeRuleReferences(plan);

  return [
    "# DevForge AI Rules",
    "",
    `Project: ${plan.projectName}`,
    `Intent: ${toTitleCase(plan.intent)}`,
    `Architecture: ${toTitleCase(plan.architecture)}`,
    `Configured tools: ${joinSentence(plan.ai.tools.map(toTitleCase))}`,
    "",
    modePreamble(plan.ai.ruleMode),
    "",
    ...selectedCategories.map((category) => categorySection(category, plan)),
    "",
    "## Recommended Rule Packs",
    "- Review the matching rule pack names below and adapt them to your project conventions.",
    ...ruleReferences.map(
      (rule) =>
        `- ${rule.category}: ${rule.name} - ${rule.rationale}`,
    ),
    "",
  ].join("\n");
}

function toCursorRule(unifiedRules: string): string {
  return [
    "---",
    "description: DevForge generated rules",
    "globs:",
    "  - \"**/*\"",
    "alwaysApply: false",
    "---",
    "",
    "<!-- Managed by DevForge. Safe to refresh with devforge upgrade. -->",
    "",
    unifiedRules,
  ].join("\n");
}

function toClaudeRule(unifiedRules: string): string {
  return withManagedBanner(unifiedRules);
}

function toAgentsFile(plan: ProjectPlan, unifiedRules: string): string {
  return withManagedBanner([
    "# AGENTS.md",
    "",
    "This project was scaffolded by DevForge CLI.",
    "",
    `Primary stack: ${joinSentence(
      [
        plan.frontend?.framework,
        plan.backend?.framework,
        plan.architecture,
      ].filter(Boolean) as string[],
    )}`,
    "",
    unifiedRules,
  ].join("\n"));
}

function toAiRuleSourcesDoc(plan: ProjectPlan): string {
  const ruleReferences = selectDevforgeRuleReferences(plan);

  return withManagedBanner([
    "# AI Rule Sources",
    "",
    "DevForge mapped this project to a curated set of stack-aligned rule pack recommendations.",
    "",
    "## Recommended Packs",
    ...ruleReferences.map(
      (rule) => `- ${rule.category}: ${rule.name} - ${rule.rationale}`,
    ),
    "",
    "## How To Use",
    "- Review the matching rule packs in the upstream repository.",
    "- Copy or adapt the relevant `.cursorrules` content into your project-specific Cursor setup.",
    "- Keep `AGENTS.md`, `.cursor/rules/`, and `.claude/rules/` aligned with any customizations you make.",
    "",
  ].join("\n"));
}

export function buildAiRuleFiles(plan: ProjectPlan): GeneratedFile[] {
  if (plan.ai.tools.length === 0) {
    return [];
  }

  const unifiedRules = buildUnifiedRules(plan);
  const files: GeneratedFile[] = [
    { path: "AGENTS.md", content: toAgentsFile(plan, unifiedRules) },
    { path: "docs/ai-rules-sources.md", content: toAiRuleSourcesDoc(plan) },
  ];

  if (plan.ai.tools.includes("cursor")) {
    files.push({
      path: ".cursor/rules/devforge.mdc",
      content: toCursorRule(unifiedRules),
    });
  }

  if (plan.ai.tools.includes("claude")) {
    files.push({
      path: ".claude/rules/devforge.md",
      content: toClaudeRule(unifiedRules),
    });
  }

  if (plan.ai.tools.includes("codex") && !files.find((file) => file.path === "AGENTS.md")) {
    files.push({ path: "AGENTS.md", content: toAgentsFile(plan, unifiedRules) });
  }

  return files;
}
