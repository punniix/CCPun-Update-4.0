import { draftMode } from 'next/headers';
import Website43Blog from '@/features/website-43-uat/Website43Blog';
import { toWebsite43ArticleItems } from '@/features/website-43-uat/blogData';
import { listWebsite43PreviewArticles } from '@/features/website-43-uat/blogPreviewData';

export default async function Page() {
  const { isEnabled } = await draftMode();
  const articles = await listWebsite43PreviewArticles({ includeDrafts: isEnabled });
  return <Website43Blog articles={toWebsite43ArticleItems(articles)} subtleMotion />;
}
