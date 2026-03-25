import type { ProjectPlan } from "./types.js";

export interface DevforgeRuleReference {
  name: string;
  category: string;
  rationale: string;
}

function reference(
  category: string,
  name: string,
  rationale: string,
): DevforgeRuleReference {
  return {
    category,
    name,
    rationale,
  };
}

export function selectDevforgeRuleReferences(
  plan: ProjectPlan,
): DevforgeRuleReference[] {
  const rules: DevforgeRuleReference[] = [
    reference(
      "Core",
      "JavaScript/TypeScript Code Quality",
      "Use as the baseline code-quality pack before layering framework-specific rules.",
    ),
    reference(
      "Core",
      "TypeScript Code Convention",
      "Use to reinforce naming, typing, and structure conventions across the scaffold.",
    ),
  ];

  switch (plan.frontend?.framework) {
    case "nextjs":
      rules.push(
        reference(
          "Frontend",
          "Next.js (React, TypeScript)",
          "Matches Next.js-first application structure and React/TypeScript workflows.",
        ),
      );
      break;
    case "react-vite":
    case "remix":
      rules.push(
        reference(
          "Frontend",
          "TypeScript (Node.js, React, Vite)",
          "Covers React and TypeScript expectations for Vite-style frontend projects.",
        ),
      );
      break;
    case "astro":
      rules.push(
        reference(
          "Frontend",
          "Astro (TypeScript)",
          "Good fit for Astro sites and content-driven frontends.",
        ),
      );
      break;
    case "angular":
      rules.push(
        reference(
          "Frontend",
          "Angular (TypeScript)",
          "Matches Angular-oriented application structure and TypeScript conventions.",
        ),
      );
      break;
    default:
      break;
  }

  if (plan.frontend?.styling === "tailwind-css" || plan.frontend?.uiLibrary === "shadcn-ui") {
    rules.push(
      reference(
        "Styling",
        "Tailwind (shadcn/ui Integration)",
        "Useful when the project relies on utility-first styling or shadcn/ui patterns.",
      ),
    );
  }

  if (plan.frontend?.state === "redux" || plan.frontend?.state === "redux-toolkit") {
    rules.push(
      reference(
        "State Management",
        "React (Redux, TypeScript)",
        "Matches Redux-style stores, actions, and typed React integration.",
      ),
    );
  }

  if (plan.frontend?.state === "mobx") {
    rules.push(
      reference(
        "State Management",
        "React (MobX)",
        "Covers observable-store patterns and React integration for MobX projects.",
      ),
    );
  }

  if (plan.frontend?.dataFetching === "tanstack-query") {
    rules.push(
      reference(
        "Data Fetching",
        "React (React Query)",
        "Useful for cache-aware async state and query lifecycle conventions.",
      ),
    );
  }

  if (plan.backend?.framework === "nestjs") {
    rules.push(
      reference(
        "Backend",
        "TypeScript (NestJS Best Practices)",
        "Matches NestJS layering, decorators, modules, and provider patterns.",
      ),
    );
  }

  if (plan.backend && plan.backend.framework !== "nestjs") {
    rules.push(
      reference(
        "Backend",
        "Node.js (MongoDB, JWT, Express, React)",
        "Use as a pragmatic Node-oriented backend reference pack for API and auth flows.",
      ),
    );
  }

  if (plan.intent === "chrome-extension") {
    rules.push(
      reference(
        "Specialized",
        "Chrome Extension (JavaScript/TypeScript)",
        "Useful for content scripts, popup UI, manifest, and extension workflow guidance.",
      ),
    );
  }

  switch (plan.testing.runner) {
    case "vitest":
      rules.push(
        reference(
          "Testing",
          "Vitest Unit Testing",
          "Matches fast unit testing for Vite-era frontend or TypeScript projects.",
        ),
      );
      break;
    case "jest":
      rules.push(
        reference(
          "Testing",
          "Jest Unit Testing",
          "Useful for broader unit-test conventions in frontend, backend, and CLI projects.",
        ),
      );
      break;
    case "playwright":
      rules.push(
        reference(
          "Testing",
          "Playwright E2E Testing",
          "Good fit for browser-first smoke and end-to-end flows.",
        ),
      );
      break;
    case "cypress":
      rules.push(
        reference(
          "Testing",
          "Cypress E2E Testing",
          "Useful for browser-based end-to-end testing and interactive workflows.",
        ),
      );
      break;
    default:
      break;
  }

  return rules;
}
