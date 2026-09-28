import Website43Home from "@/features/home/website-43/Website43Home";
import { homeFaqs } from "@/features/home/website-43/homeFaqs";
import { getPrimaryAuthorProfile } from "@/lib/content/sanity";
import { buildProfessionalQualificationPersonSchema } from "@/lib/seo/structured-data/site-schema";

export default async function Home() {
  const authorProfile = await getPrimaryAuthorProfile();
  const professionalQualificationSchema = buildProfessionalQualificationPersonSchema(authorProfile?.professionalQualifications ?? []);
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
    {professionalQualificationSchema ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(professionalQualificationSchema).replace(/</g, "\\u003c") }} /> : null}
    <Website43Home authorProfile={authorProfile} />
  </>;
}
