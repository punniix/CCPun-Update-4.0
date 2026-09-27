export type ArticleStatus = "draft" | "published";

export type ArticleInline = {
  text: string;
  href?: string;
  strong?: boolean;
  emphasis?: boolean;
  openInNewTab?: boolean;
  nofollow?: boolean;
  sponsored?: boolean;
};

export type ArticleRichText = {
  text: string;
  segments?: ArticleInline[];
};

export type ArticleBlock =
  | ({ type: "paragraph" } & ArticleRichText)
  | ({ type: "heading"; level: 2 | 3 } & ArticleRichText)
  | { type: "bulletList"; items: Array<string | ArticleRichText> }
  | { type: "numberList"; items: Array<string | ArticleRichText> }
  | ({ type: "quote" } & ArticleRichText)
  | { type: "callout"; title?: string; text: string }
  | { type: "image"; src: string; alt: string; width: number; height: number; caption?: string; credit?: string }
  | { type: "gallery"; images: Array<{ src: string; alt: string; width: number; height: number; caption?: string; credit?: string }> }
  | { type: "cta"; label: string; url: string; style: "primary" | "secondary"; openInNewTab?: boolean }
  | { type: "pdf"; title: string; description?: string; url: string; filename?: string; size?: number }
  | { type: "details"; summary: string; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "divider" };

export type ArticleSource = {
  label: string;
  url?: string;
  publisher?: string;
  accessedAt?: string;
};

export type ArticleFaq = {
  question: string;
  answer: string;
};

export type ArticleReview = {
  status?: "content-review" | "ready-for-coo" | "approved";
  contentReviewedAt?: string;
  factCheckedAt?: string;
  complianceReviewedAt?: string;
};

export type ArticleAuthorProfile = {
  name: string;
  profileName?: string;
  profileRole?: string;
  profileBio?: string;
  profileCtaLabel?: string;
  profileCtaUrl?: string;
  profileAvatar?: {
    src: string;
    alt: string;
    width: number;
    height: number;
  };
};

export type ArticleGeo = {
  summary?: string;
  keyEntities?: string[];
  keyQuestions?: string[];
};

export type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  lineTitle?: string;
  lineDescription?: string;
  category: string;
  categorySlug?: string;
  tags?: string[];
  semanticTopic?: string;
  authorName: string;
  author?: ArticleAuthorProfile;
  status: ArticleStatus;
  publishedAt?: string;
  updatedAt: string;
  seoTitle: string;
  seoDescription: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: {
    src: string;
    alt: string;
    width: number;
    height: number;
  };
  canonical?: string;
  noindex?: boolean;
  legacyUrl?: string;
  featuredImage?: {
    src: string;
    alt: string;
    width: number;
    height: number;
    caption?: string;
    credit?: string;
  };
  body: ArticleBlock[];
  faq?: ArticleFaq[];
  sources?: ArticleSource[];
  geo?: ArticleGeo;
  review?: ArticleReview;
};

export interface ContentProvider {
  listArticles(options?: { includeDrafts?: boolean }): Promise<Article[]>;
  getArticleBySlug(slug: string, options?: { includeDrafts?: boolean }): Promise<Article | null>;
}
