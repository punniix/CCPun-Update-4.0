import { NextResponse } from "next/server";
import { observeAiCrawlerRequest } from "@/lib/observability/ai-crawler";

export default function proxy(request: Request & { nextUrl: URL }) {
  const pathname = new URL(request.url).pathname;
  const headers = request.headers;

  observeAiCrawlerRequest({
    userAgent: headers.get("user-agent"),
    pathname,
    method: request.method,
    requestId: headers.get("x-request-id"),
    vercelRequestId: headers.get("x-vercel-id"),
    cloudflareRay: headers.get("cf-ray"),
  });

  return NextResponse.next();
}

export const config = {
  matcher: [
    {
      source: "/:path*",
      has: [
        {
          type: "header",
          key: "user-agent",
          value: "(GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-SearchBot|Claude-User|PerplexityBot|Perplexity-User|Google-CloudVertexBot|Bytespider|CCBot|meta-externalagent|meta-externalfetcher|FacebookBot|Applebot|Amazonbot|DuckAssistBot|MistralAI-User)",
        },
      ],
    },
  ],
};
