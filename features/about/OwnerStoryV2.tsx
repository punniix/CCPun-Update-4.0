import Image from "next/image";
import V5CredentialCards from "@/components/layout/v5/V5CredentialCards";
import V5ChatLink from "@/components/layout/v5/V5ChatLink";
import { V5_LINE_URL } from "@/components/layout/v5/constants";
import type { publicCopyText } from "@/lib/content/public-copy-registry";
import styles from "./About.module.css";

// Render ONLY on UAT via AboutPage. Exact owner-approved source order is
// pinned by the scoped review test; defaults are editable in Sanity About copy.
const CHAPTERS = [
  {
    "heading": "about.storyV2.c1.heading",
    "paragraphs": [
      "about.storyV2.c1.p1",
      "about.storyV2.c1.p2",
      "about.storyV2.c1.p3",
      "about.storyV2.c1.p4",
      "about.storyV2.c1.p5",
      "about.storyV2.c1.p6",
      "about.storyV2.c1.p7",
      "about.storyV2.c1.p8",
      "about.storyV2.c1.p9"
    ]
  },
  {
    "heading": "about.storyV2.c2.heading",
    "paragraphs": [
      "about.storyV2.c2.p1",
      "about.storyV2.c2.p2",
      "about.storyV2.c2.p3",
      "about.storyV2.c2.p4",
      "about.storyV2.c2.p5",
      "about.storyV2.c2.p6",
      "about.storyV2.c2.p7",
      "about.storyV2.c2.p8",
      "about.storyV2.c2.p9",
      "about.storyV2.c2.p10",
      "about.storyV2.c2.p11"
    ]
  },
  {
    "heading": "about.storyV2.c3.heading",
    "paragraphs": [
      "about.storyV2.c3.p1",
      "about.storyV2.c3.p2",
      "about.storyV2.c3.p3",
      "about.storyV2.c3.p4",
      "about.storyV2.c3.p5",
      "about.storyV2.c3.p6",
      "about.storyV2.c3.p7"
    ]
  },
  {
    "heading": "about.storyV2.c4.heading",
    "paragraphs": [
      "about.storyV2.c4.p1",
      "about.storyV2.c4.p2",
      "about.storyV2.c4.p3",
      "about.storyV2.c4.p4",
      "about.storyV2.c4.p5",
      "about.storyV2.c4.p6",
      "about.storyV2.c4.p7"
    ]
  }
] as const;
type AboutText = ReturnType<typeof publicCopyText>;
type Credential = { term: string; detail: string };
function Paragraphs({ keys, text }: { keys: readonly (typeof CHAPTERS)[number]["paragraphs"][number][]; text: AboutText }) {
  return <>{keys.map((key) => <p key={key}>{text.node(key)}</p>)}</>;
}
function OwnerPhoto({ src, alt, width, height, caption }: { src: string; alt: string; width: number; height: number; caption?: string }) {
  return <figure className={styles.ownerStoryPhoto}>
    <Image src={src} alt={alt} width={width} height={height} sizes="(max-width: 899px) calc(100vw - 40px), (max-width: 1279px) 38vw, 456px" loading="lazy" />
    {caption ? <figcaption>{caption}</figcaption> : null}
  </figure>;
}
export default function OwnerStoryV2({ text, qualification, licenceCards }: {
  text: AboutText;
  qualification: Credential | null;
  licenceCards: readonly Credential[];
}) {
  const [university, father, career, today] = CHAPTERS;
  return <article className={styles.ownerStoryV2} data-owner-story-v2="approved-20261029">
    <section className={styles.ownerStoryChapter} aria-labelledby="about-owner-story-one">
      <h2 id="about-owner-story-one">{text.node(university.heading)}</h2>
      <div className={styles.ownerStoryPair}>
        <div className={styles.ownerStoryCopy}><Paragraphs keys={university.paragraphs.slice(0, 7)} text={text} /></div>
        <OwnerPhoto src="/assets/owner-scbs-u-invest.webp" alt="ภาพการแข่งขัน SCBS U-Invest" width={2448} height={3060} />
      </div>
      <div className={styles.ownerStoryPair}>
        <div className={styles.ownerStoryCopy}><Paragraphs keys={university.paragraphs.slice(7)} text={text} /></div>
        <div className={styles.ownerStoryCareerPhotos}>
          <OwnerPhoto src="/assets/owner-phillip-seminar.webp" alt="โปสเตอร์สัมมนาของ บล.ฟิลลิป" width={1040} height={1040} />
          <OwnerPhoto src="/assets/owner-bitkub.webp" alt="ภาพจากช่วงทำงานที่ Bitkub" width={1364} height={1364} />
        </div>
      </div>
    </section>
    <section className={styles.ownerStoryChapter} aria-labelledby="about-owner-story-two">
      <h2 id="about-owner-story-two">{text.node(father.heading)}</h2>
      <div className={styles.ownerStoryPair}>
        <div className={styles.ownerStoryCopy}>
          <Paragraphs keys={father.paragraphs.slice(0, 2)} text={text} />
          <blockquote className={styles.ownerStoryMotto}>{text.node(father.paragraphs[2])}</blockquote>
        </div>
        <OwnerPhoto src="/assets/ccpun-father-v5-colour.webp" alt={text("about.father.photoAlt")} width={1086} height={1448} />
      </div>
      <div className={styles.ownerStoryCopy}><Paragraphs keys={father.paragraphs.slice(3)} text={text} /></div>
    </section>
    <section className={styles.ownerStoryChapter} aria-labelledby="about-owner-story-three">
      <h2 id="about-owner-story-three">{text.node(career.heading)}</h2>
      <div className={styles.ownerStoryCopy}><Paragraphs keys={career.paragraphs} text={text} /></div>
      <V5CredentialCards className={styles.credentials} qualification={qualification} licenceCards={licenceCards} />
    </section>
    <section className={styles.ownerStoryChapter} aria-labelledby="about-owner-story-four">
      <h2 id="about-owner-story-four">{text.node(today.heading)}</h2>
      <div className={styles.ownerStoryCopy}><Paragraphs keys={today.paragraphs} text={text} /></div>
      <V5ChatLink href={V5_LINE_URL} className={styles.ownerStoryChatLink}>{text.node("about.storyV2.ctaLabel")}</V5ChatLink>
    </section>
  </article>;
}
