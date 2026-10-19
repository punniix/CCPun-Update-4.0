import type { ResolvingMetadata } from "next";
import { resolvePageSeoMetadata } from "@/lib/seo/page-seo";
import { buildSiteRootMetadata } from "@/lib/seo/root-metadata";
import { IS_WEB_REVIEW_ENVIRONMENT } from "../runtime-environment";
import Website43Home from "@/features/home/website-43/Website43Home";
import { homeFaqs } from "@/features/home/website-43/homeFaqs";
import { getPrimaryAuthorProfile } from "@/lib/content/sanity";

export default async function Home() {
  const authorProfile = await getPrimaryAuthorProfile();
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
    <Website43Home authorProfile={authorProfile} />
  </>;
}

export function generateMetadata(props: unknown, parent: ResolvingMetadata) {
  void props;
  return resolvePageSeoMetadata("/", buildSiteRootMetadata({ admin: false, review: IS_WEB_REVIEW_ENVIRONMENT }), parent);
}
