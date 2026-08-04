'use client';
import { useEffect, useState } from 'react';
import type { EngineSnapshot } from '@internal/whatsapp-engine';

/**
 * Subscribe to the wa-engine's state via SSE.
 *
 * The engine IS the single source of truth — this hook does NOT
 * store, manage, or synchronize any WhatsApp state. It simply
 * receives EngineSnapshot events from the SSE stream and passes
 * them to React state.
 *
 * No polling. No timers. No intervals. Pure event consumption.
 */
export function useWhatsAppPlatform() {
    const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);

    useEffect(() => {
        const source = new EventSource('/api/whatsapp/events');
        source.addEventListener('state', (event) => {
            try {
                const data = JSON.parse((event as MessageEvent).data);
                setSnapshot(data);
            } catch {
                // ignore malformed messages
            }
        });
        return () => source.close();
    }, []);

    return snapshot;
}
