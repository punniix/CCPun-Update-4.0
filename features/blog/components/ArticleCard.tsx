import Image from "next/image";
import Link from "next/link";
import { BookOpen, CalendarDays } from "lucide-react";
import type { Article } from "@/lib/content/types";
import { getArticleSemanticTopic } from "@/lib/content/taxonomy";
import { getArticlePath } from "@/lib/content/url";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(value));
}

export default function ArticleCard({ article, showDraft = false }: { article: Article; showDraft?: boolean }) {
  const href = getArticlePath(article);
  const semanticTopic = getArticleSemanticTopic({
    articleSlug: article.slug,
    semanticTopic: article.semanticTopic,
    categoryTitle: article.category,
    categorySlug: article.categorySlug,
    tags: article.tags,
  });
  const topicName = semanticTopic?.title ?? article.category;

  return (
    <article data-article-slug={article.slug}>
      <Link
        href={href}
        data-article-link
        className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-2xl"
      >
        <div className="blog-card overflow-hidden">
          <div className="blog-card__media relative overflow-hidden">
            {article.featuredImage ? (
              <Image
                src={article.featuredImage.src}
                alt={article.featuredImage.alt}
                width={article.featuredImage.width}
                height={article.featuredImage.height}
                sizes="(max-width: 768px) 100vw, 480px"
                className="blog-card__image"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-secondary">
                <BookOpen className="h-12 w-12 text-muted-foreground opacity-30" aria-hidden="true" />
              </div>
            )}
            <div className="blog-card__image-overlay absolute inset-0" aria-hidden="true" />
          </div>

          <div className="blog-card-content p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="blog-card__category inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {topicName}
              </span>
              {showDraft && article.status === "draft" && (
                <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground">
                  ฉบับร่าง Preview
                </span>
              )}
            </div>

            <h2 className="line-clamp-2 text-lg font-semibold text-foreground transition-colors duration-300 group-hover:text-primary">
              {article.title}
            </h2>
            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{article.excerpt}</p>

            <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{formatDate(article.updatedAt)}</span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
