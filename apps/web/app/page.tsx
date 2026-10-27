import type { ResolvingMetadata } from "next";
import { resolvePageSeoMetadata } from "@/lib/seo/page-seo";
import { buildSiteRootMetadata } from "@/lib/seo/root-metadata";
import { IS_WEB_REVIEW_ENVIRONMENT } from "../runtime-environment";
import V5Home from "@/features/home/v5/V5Home";
import { getPublicCopy } from "@/lib/content/public-copy";
import { getHomeCopyFaqs } from "@/features/home/website-43/homeFaqs";
import { getPrimaryAuthorProfile } from "@/lib/content/sanity";

export default async function Home() {
  const [authorProfile, copy] = await Promise.all([getPrimaryAuthorProfile(), getPublicCopy("home")]);
  const homeFaqs = getHomeCopyFaqs(copy);
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": "https://ccpun.com/#faq",
    url: "https://ccpun.com/#faq",
    mainEntity: homeFaqs.map(({ question, answer }) => ({
      "@type": "Question", name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }} />
    <V5Home authorProfile={authorProfile} copy={copy} faqs={homeFaqs} />
  </>;
}

export function generateMetadata(props: unknown, parent: ResolvingMetadata) {
  void props;
  const defaults = buildSiteRootMetadata({ admin: false, review: IS_WEB_REVIEW_ENVIRONMENT });
  if (IS_WEB_REVIEW_ENVIRONMENT) delete defaults.icons;
  return resolvePageSeoMetadata("/", defaults, parent);
}
