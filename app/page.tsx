import Website43Home from "@/features/home/website-43/Website43Home";
import { homeFaqs } from "@/features/home/website-43/homeFaqs";

export default function Home() {
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
    <Website43Home />
  </>;
}
