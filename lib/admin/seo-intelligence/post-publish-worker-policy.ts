type Env = Record<string, string | undefined>;

export function workerDatabaseIdentity(env: Env = process.env): boolean {
  if (env.CCPUN_BACKGROUND_EXECUTION_PLANE !== "vps" || env.CCPUN_SEO_POST_PUBLISH_WORKER_ENABLED !== "1"
    || env.CCPUN_APP_ENV !== "production-admin" || env.CCPUN_DEPLOYMENT_PROVIDER !== "hostinger"
    || env.CCPUN_DEPLOYMENT_ROLE !== "admin" || Object.keys(env).some((key) => key.startsWith("VERCEL_") && Boolean(env[key]))
    || Boolean(env.NEXT_RUNTIME)) return false;
  const connection = env.CCPUN_SEO_POST_PUBLISH_DATABASE_URL;
  if (!connection) return false;
  try {
    const url = new URL(connection);
    return url.protocol === "postgresql:"
      && decodeURIComponent(url.username) === "ccpun_seo_post_publish_worker"
      && Boolean(url.password)
      && url.hostname === "ep-broad-butterfly-b3ro7u8w.c-4.ap-southeast-1.aws.neon.tech"
      && !url.port && !url.hash
      && decodeURIComponent(url.pathname) === "/neondb"
      && url.searchParams.get("sslmode") === "require"
      && env.CCPUN_NEON_PROJECT_ID === "lively-bar-43618798"
      && env.CCPUN_NEON_BRANCH_ID === "br-long-resonance-b3ys5xrv"
      && env.CCPUN_NEON_DATABASE === "neondb";
  } catch { return false; }
}


export function isPostPublishWorkerSourceAllowed(
  env: Record<string, string | undefined> = process.env, head?: string,
) {
  return workerDatabaseIdentity(env)
    && Boolean(head && /^[a-f0-9]{40}$/.test(head))
    && env.CCPUN_GIT_SHA === head
    && Boolean(env.CCPUN_GIT_REF?.endsWith(head!))
    && env.CCPUN_NATIVE_WORKFLOW_ENABLED === "0"
    && env.CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED === "0";
}
