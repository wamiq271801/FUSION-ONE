/**
 * Internal event bus — typed pub/sub for Engine events.
 *
 * Used internally by all Engine subsystems (browser manager, session manager,
 * job manager, queue, scheduler) to communicate without direct coupling.
 *
 * The public `subscribe()` API on the Engine facade taps into this same bus
 * so the Next.js adapter receives every state change.
 */
import type { EngineEvent, EventListener } from './types';

class EventBus {
    private listeners = new Set<EventListener>();
    private readonly maxListeners = 100;

    subscribe(listener: EventListener): () => void {
        if (this.listeners.size >= this.maxListeners) {
            console.error('[engine:event-bus] max listeners reached, rejecting new subscription');
            return () => {};
        }
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    emit(event: EngineEvent): void {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (err) {
                console.error('[engine:event-bus] listener threw:', err);
            }
        }
    }
}

export const eventBus = new EventBus();
