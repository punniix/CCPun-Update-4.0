import type { BlogTopicSlug } from "@/lib/content/taxonomy";

/**
 * Next-step CTA per topic (internal-linking plan T08). Targets are existing
 * public owners only. Health has no tool yet, so it points at the generic
 * Copayment owner; AIA Health CI Hero is never routed to /ci-planning/.
 */
export type NextStepTarget =
  | { kind: "tool"; tool: "ci" | "fhc" | "moneyStory" }
  | { kind: "article"; slug: string }
  | { kind: "line" };

export const HEALTH_NEXT_STEP_ARTICLE = "copayment-vs-deductible-health-insurance";

export function resolveNextSteps(topic: BlogTopicSlug | null | undefined, articleSlug: string): NextStepTarget[] {
  switch (topic) {
    case "critical-illness-insurance": return [{ kind: "tool", tool: "ci" }];
    case "life-insurance": return [{ kind: "tool", tool: "fhc" }];
    case "personal-finance": return [{ kind: "tool", tool: "fhc" }, { kind: "tool", tool: "moneyStory" }];
    case "health-insurance": return articleSlug === HEALTH_NEXT_STEP_ARTICLE ? [{ kind: "line" }] : [{ kind: "article", slug: HEALTH_NEXT_STEP_ARTICLE }];
    default: return [{ kind: "line" }];
  }
}

/** Topic-hub tool card (category page). CI hub renders its taxonomy `featuredLink` (plan T03). */
export function resolveHubTools(topic: string): Array<"ci" | "fhc" | "moneyStory"> {
  switch (topic) {
    case "critical-illness-insurance": return ["ci"];
    case "health-insurance": return ["ci", "fhc"];
    case "life-insurance": return ["fhc"];
    case "personal-finance": return ["fhc", "moneyStory"];
    default: return [];
  }
}
