import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText } from "@/lib/content/public-copy-registry";
import styles from '@/components/layout/website-43/Website43.module.css';

type TocHeading = { id: string; label: string; level: number };
export type TocGroup = { primary: TocHeading; children: TocHeading[] };

export default async function Website43ArticleToc({ groups }: { groups: TocGroup[] }) {
  const copy = await getPublicCopy("blog");
  const copyText = publicCopyText(copy);


  return <nav className={styles.tocList} aria-label={copyText("blog.website43ArticleTocarialabel")}>
    {groups.map(group => <div className={styles.tocGroup} key={group.primary.id}>
      <a className={styles.tocPrimary} href={`#${group.primary.id}`} data-level={group.primary.level} style={{ textWrap: 'pretty' }}><span aria-hidden="true" />{group.primary.label}</a>
      {group.children.map(heading => <a className={heading.level === 4 ? styles.tocTertiary : styles.tocSecondary} href={`#${heading.id}`} key={heading.id} data-level={heading.level} style={{ textWrap: 'pretty' }}><span aria-hidden="true" />{heading.label}</a>)}
    </div>)}
  </nav>;
}
