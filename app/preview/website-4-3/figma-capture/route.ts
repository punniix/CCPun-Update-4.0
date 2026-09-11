export const dynamic = 'force-dynamic';

export async function GET() {
  const response = await fetch('https://mcp.figma.com/mcp/html-to-design/capture.js', { cache: 'no-store' });
  if (!response.ok) return new Response('Capture script unavailable', { status: 502 });
  return new Response(await response.arrayBuffer(), {
    status: 200,
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
