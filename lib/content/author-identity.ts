import type { Article, ArticleAuthorProfile } from "./types";

// The internal Author.name may still be "CCPun"; it is not the public person's name.
export function getPublicAuthorName(author?: ArticleAuthorProfile | null): string {
  const managedName = author?.profileName?.trim();
  if (managedName) return managedName;
  const legacyName = author?.name?.trim();
  return legacyName && legacyName !== "CCPun" && legacyName !== "CCPun UAT Author"
    ? legacyName
    : "ชนาธิป ชิตประเสริฐ";
}

export function getArticleAuthorIdentity(article: Pick<Article, "author" | "authorName">) {
  const profile = article.author;
  const canonicalAdvisor = ["ccpun-author-ccpun-profile", "ccpun-prod-mirror-author-ccpun"].includes(profile?.id ?? "");
  const rawName = profile?.profileName?.trim() || profile?.name?.trim() || article.authorName?.trim();
  const avatar = profile?.profileAvatar;
  return {
    canonicalAdvisor,
    name: canonicalAdvisor ? getPublicAuthorName(profile) : rawName,
    role: profile?.profileRole?.trim(),
    bio: profile?.profileBio?.trim(),
    avatar: !canonicalAdvisor && avatar?.src.startsWith("/assets/ccpun.webp") ? undefined : avatar,
    profileCtaUrl: /^(https?:\/\/|\/(?!\/)|#)/.test(profile?.profileCtaUrl ?? "") ? profile?.profileCtaUrl : undefined,
  };
}
