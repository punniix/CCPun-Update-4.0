import type { Article } from "../types";
import type { BlogTopicHub } from "../taxonomy";
import { getArticleSemanticTopic } from "../taxonomy";
import { getArticleCanonical } from "../url";
import { CCPUN_PERSON_ID } from "@/lib/seo/structured-data/entity-ids";

const SITE_URL = "https://ccpun.com";

function semanticTopicFor(article: Article) {
  return getArticleSemanticTopic({
    articleSlug: article.slug,
    semanticTopic: article.semanticTopic,
    categoryTitle: article.category,
    categorySlug: article.categorySlug,
    tags: article.tags,
  });
}

export function buildArticleSchemaGraph(article: Article) {
  if (article.status !== "published" || !article.publishedAt) return null;

  const canonical = getArticleCanonical(article);
  const semanticTopic = semanticTopicFor(article);
  const sectionName = semanticTopic?.title ?? article.category;
  const sectionUrl = semanticTopic ? `${SITE_URL}/blog/${semanticTopic.slug}/` : `${SITE_URL}/blog/`;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "BlogPosting",
      "@id": `${canonical}#article`,
      headline: article.title,
      description: article.excerpt,
      datePublished: article.publishedAt,
      dateModified: article.updatedAt,
      mainEntityOfPage: canonical,
      articleSection: sectionName,
      ...(article.tags?.length ? { keywords: article.tags.join(", ") } : {}),
      ...(article.featuredImage
        ? {
            image: {
              "@type": "ImageObject",
              url: article.featuredImage.src.startsWith("http")
                ? article.featuredImage.src
                : `${SITE_URL}${article.featuredImage.src}`,
              caption: article.featuredImage.caption ?? article.featuredImage.alt,
            },
          }
        : {}),
      author: { "@id": CCPUN_PERSON_ID },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${canonical}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "หน้าแรก", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "บทความ", item: `${SITE_URL}/blog/` },
        { "@type": "ListItem", position: 3, name: sectionName, item: sectionUrl },
        { "@type": "ListItem", position: 4, name: article.title, item: canonical },
      ],
    },
  ];

  if (article.faq?.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${canonical}#faq`,
      mainEntity: article.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export function buildBlogTopicHubSchema(hub: BlogTopicHub, articles: Article[]) {
  const hubUrl = `${SITE_URL}/blog/${hub.slug}/`;
  const publishedArticles = articles.filter((article) => article.status === "published");
  const graph: Record<string, unknown>[] = [
    {
      "@type": "CollectionPage",
      "@id": `${hubUrl}#collection`,
      url: hubUrl,
      name: hub.title,
      headline: hub.title,
      description: hub.description,
      isPartOf: { "@id": `${SITE_URL}/blog/#collection` },
      ...(publishedArticles.length ? { mainEntity: { "@id": `${hubUrl}#articles` } } : {}),
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${hubUrl}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "หน้าแรก", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "บทความ", item: `${SITE_URL}/blog/` },
        { "@type": "ListItem", position: 3, name: hub.title, item: hubUrl },
      ],
    },
  ];

  if (publishedArticles.length) {
    graph.push({
      "@type": "ItemList",
      "@id": `${hubUrl}#articles`,
      name: `บทความ${hub.title}`,
      numberOfItems: publishedArticles.length,
      itemListElement: publishedArticles.map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: article.title,
        url: getArticleCanonical(article),
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}
