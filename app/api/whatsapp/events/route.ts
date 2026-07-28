import { whatsappManager } from '@/lib/whatsapp/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;
  const stream = new ReadableStream({
    start(controller) {
      const publish = () => controller.enqueue(encoder.encode(`event: state\ndata: ${JSON.stringify({ state: whatsappManager.getState(), diagnostics: whatsappManager.getDiagnostics() })}\n\n`));
      publish();
      const unsubscribe = whatsappManager.subscribe(publish);
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(': keepalive\n\n')), 25_000);
      cleanup = () => { clearInterval(heartbeat); unsubscribe(); };
    },
    cancel() { cleanup?.(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
