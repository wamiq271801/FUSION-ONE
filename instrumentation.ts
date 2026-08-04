/**
 * Next.js Instrumentation hook — runs once on Node runtime boot.
 *
 * Starts the wa-engine (internal WhatsApp Engine) on server boot.
 * The engine manages its own browser lifecycle, authentication, QR,
 * session persistence, and queue.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    const { deliveryService } = await import('./domains/delivery');
    void deliveryService.start().catch((err: unknown) => {
        console.error('[wa-engine] FATAL: failed to start on boot:', err);
    });
}
