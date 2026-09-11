type RouteContext = { params: Promise<{ captureId: string }> };

export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: RouteContext) {
  const { captureId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(captureId)) return new Response('Invalid capture ID', { status: 400 });

  const contentType = request.headers.get('content-type') ?? 'application/octet-stream';
  const response = await fetch(`https://mcp.figma.com/mcp/capture/${captureId}/submit?bindVariables=true`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: await request.arrayBuffer(),
    cache: 'no-store',
  });

  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
