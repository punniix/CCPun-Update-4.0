export function shouldEnforceHttps(appEnvironment = process.env.CCPUN_APP_ENV) {
  return appEnvironment !== "local-uat" && appEnvironment !== "local-production";
}

export function buildNextSecurityHeaders({
  isReviewEnvironment = false,
  sanityProjectId = "",
  nodeEnv = process.env.NODE_ENV,
  appEnvironment = process.env.CCPUN_APP_ENV,
} = {}) {
  const isDevelopment = nodeEnv === "development";
  const enforceHttps = shouldEnforceHttps(appEnvironment);
  const sanityReviewScriptSources = isReviewEnvironment
    ? " https://core.sanity-cdn.com"
    : "";
  const sanityConnectSources = /^[a-z0-9]+$/.test(sanityProjectId)
    ? ` https://${sanityProjectId}.api.sanity.io wss://${sanityProjectId}.api.sanity.io`
    : "";
  const sanityReviewConnectSources = isReviewEnvironment
    ? " https://sanity-cdn.com https://*.sanity-cdn.com"
    : "";

  const policy = [
    ...(enforceHttps ? ["upgrade-insecure-requests"] : []),
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://connect.facebook.net https://static.cloudflareinsights.com https://*.cloudflare.com https://apis.google.com https://accounts.google.com${sanityReviewScriptSources}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com https://static.cloudflareinsights.com https://fonts.googleapis.com https://fonts.gstatic.com https://lead-proxy.ccpun.com https://www.googleapis.com https://accounts.google.com${sanityConnectSources}${sanityReviewConnectSources}`,
    "frame-src 'self' https://www.facebook.com https://accounts.google.com https://docs.google.com",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://www.facebook.com",
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: policy },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    ...(enforceHttps
      ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
      : []),
  ];
}
