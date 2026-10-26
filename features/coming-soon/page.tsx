import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveContentEnvironment } from "@/lib/content/sanity-lane";
import {
  COMING_SOON_CHAT_LABEL,
  comingSoonChatPrefill,
  comingSoonMetadata,
  comingSoonSlug,
  findComingSoonPage,
  listComingSoonPages,
  type ComingSoonPage,
} from "@/lib/content/coming-soon";
import V5Page from "@/components/layout/v5/V5Page";
import shell from "@/components/layout/v5/V5.module.css";
import { V5Breadcrumbs } from "@/components/layout/v5/V5Primitives";
import { V5_TOOLS_HUB } from "@/components/layout/v5/constants";
import { getV5ChatFallbackHref } from "@/components/layout/v5/V5ChatDockServer";
import ComingSoonBlueprint from "./ComingSoonBlueprint";
import ComingSoonInterest from "./ComingSoonInterest";
import styles from "./ComingSoon.module.css";

type Params = { slug: string };

function pageFor(slug: string): ComingSoonPage | undefined {
  return findComingSoonPage(`/tools/${slug}/`, resolveContentEnvironment());
}

/** Only registered paths are generated; with `dynamicParams = false` every other slug is the real 404. */
export function generateStaticParams(): Params[] {
  return listComingSoonPages(resolveContentEnvironment()).map((page) => ({ slug: comingSoonSlug(page) }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const page = pageFor((await params).slug);
  return page ? comingSoonMetadata(page) : { robots: { index: false, follow: false } };
}

export default async function ComingSoonRoute({ params }: { params: Promise<Params> }) {
  const page = pageFor((await params).slug);
  if (!page) notFound();
  const chatTopic = {
    id: page.chatTopicId,
    ref: page.chatRef,
    label: COMING_SOON_CHAT_LABEL,
    prefill: comingSoonChatPrefill(page),
    journey: "human" as const,
    enabled: true,
  };
  const chatContext = { pageGroup: "coming_soon" };
  // No-JS fallback of "อยากให้เสร็จเร็ว": the dock's own first topic link (this page's topic first).
  const interestHref = await getV5ChatFallbackHref(chatContext, chatTopic);
  const action = page.closestExisting.kind === "tool" ? "ลองใช้เครื่องมือนี้" : "อ่านบทความนี้";

  return (
    <V5Page current={page.path} chat={{ pageGroup: "coming_soon" }} chatTopic={chatTopic}>
      <section className={styles.hero} aria-labelledby="coming-soon-title">
        <div className={shell.inner}>
          <V5Breadcrumbs label="เส้นทางของหน้า" items={[{ href: "/", label: "หน้าแรก" }, { href: V5_TOOLS_HUB.href, label: V5_TOOLS_HUB.label }, { label: page.title }]} />
          <div className={styles.heroGrid}>
            <div className={styles.heroText}>
              <h1 id="coming-soon-title" className={shell.h1}>{page.title}</h1>
              <p className={styles.status}>หน้านี้กำลังสร้างอยู่</p>
              <p className={shell.lead}>{page.intent}</p>
              {page.expected ? <p className={styles.expected}>คาดว่าจะเปิดใช้ {page.expected}</p> : null}
              <ComingSoonInterest path={page.path} href={interestHref} />
            </div>
            <ComingSoonBlueprint variant={page.blueprint} />
          </div>
        </div>
      </section>
      <section className={shell.sectionAlt} aria-labelledby="coming-soon-meanwhile">
        <div className={shell.inner}>
          <h2 id="coming-soon-meanwhile" className={shell.h2}>ระหว่างนี้ลองใช้</h2>
          <article className={styles.meanwhile}>
            <h3 className={shell.h3}>{page.closestExisting.label}</h3>
            <p>{page.closestExisting.note}</p>
            <Link className={shell.button} href={page.closestExisting.path}>{action}</Link>
          </article>
        </div>
      </section>
    </V5Page>
  );
}
