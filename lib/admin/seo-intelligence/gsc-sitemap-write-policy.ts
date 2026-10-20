type Env = Record<string, string | undefined>;

export function isGscSitemapWriteApproved(env: Env = process.env) {
  return env.CCPUN_BACKGROUND_EXECUTION_PLANE === "vps"
    && env.CCPUN_SEO_POST_PUBLISH_WORKER_ENABLED === "1"
    && env.CCPUN_GSC_SITEMAP_WRITE_ENABLED === "1"
    && env.CCPUN_GSC_SITE_URL === "sc-domain:ccpun.com"
    && Boolean(env.CCPUN_GSC_SITEMAP_CLIENT_ID && env.CCPUN_GSC_SITEMAP_CLIENT_SECRET && env.CCPUN_GSC_SITEMAP_REFRESH_TOKEN)
    && env.CCPUN_GSC_SITEMAP_REFRESH_TOKEN !== env.CCPUN_GOOGLE_DATA_REFRESH_TOKEN;
}
