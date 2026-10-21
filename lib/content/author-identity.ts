import type { ArticleAuthorProfile } from "./types";

// The internal Author.name may still be "CCPun"; it is not the public person's name.
export function getPublicAuthorName(author?: ArticleAuthorProfile | null): string {
  const managedName = author?.profileName?.trim();
  if (managedName) return managedName;
  const legacyName = author?.name?.trim();
  return legacyName && legacyName !== "CCPun" && legacyName !== "CCPun UAT Author"
    ? legacyName
    : "ชนาธิป ชิตประเสริฐ";
}
