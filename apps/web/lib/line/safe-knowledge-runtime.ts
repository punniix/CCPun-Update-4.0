import "server-only";

import { sanityContentProvider } from "../../../../lib/content/sanity";
import { getArticlePath } from "../../../../lib/content/url";
import {
  SAFE_KNOWLEDGE_REGISTRY,
  parseSafeKnowledgeRequest,
  requiresHumanKnowledgeHandoff,
  type SafeKnowledgeDecision,
} from "../../../../lib/line/safe-knowledge";

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("th-TH");
}

export async function resolveSafeKnowledge(input: unknown): Promise<SafeKnowledgeDecision | null> {
  const request = parseSafeKnowledgeRequest(input);
  if (!request) return null;

  if (request.explicit_human_request) {
    return { kind: "human_handoff", questionId: request.question_id, reason: "human_requested" };
  }
  if (requiresHumanKnowledgeHandoff(request)) {
    return { kind: "human_handoff", questionId: request.question_id, reason: "personalized" };
  }

  const registry = SAFE_KNOWLEDGE_REGISTRY[request.question_id];
  if (!registry.sourceSlug) {
    return { kind: "human_handoff", questionId: request.question_id, reason: "no_approved_answer" };
  }

  let article;
  try {
    article = await sanityContentProvider.getArticleBySlug(registry.sourceSlug, { includeDrafts: false });
  } catch {
    return { kind: "human_handoff", questionId: request.question_id, reason: "source_unavailable" };
  }
  if (!article || article.status !== "published" || article.noindex === true) {
    return { kind: "human_handoff", questionId: request.question_id, reason: "source_unavailable" };
  }

  const sourcePath = getArticlePath(article);
  const keywords = registry.faqKeywords.map(normalize);
  const faq = article.faq?.find((item) => {
    const question = normalize(item.question);
    return keywords.length > 0 && keywords.every((keyword) => question.includes(keyword));
  });

  if (faq?.answer?.trim()) {
    return {
      kind: "approved_answer",
      questionId: request.question_id,
      sourceSlug: article.slug,
      sourcePath,
      answer: faq.answer.trim(),
    };
  }

  return {
    kind: "related_content",
    questionId: request.question_id,
    sourceSlug: article.slug,
    sourcePath,
  };
}
