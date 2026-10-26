// Coming Soon (owner-approved concept, 2026-10-25): only paths registered in lib/content/coming-soon.ts
// render here; every other /tools/<slug>/ is the real 404.
export const dynamicParams = false;
export { default, generateMetadata, generateStaticParams } from "@/features/coming-soon/page";
