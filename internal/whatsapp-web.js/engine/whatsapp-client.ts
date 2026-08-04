/**
 * WhatsApp Client Wrapper — owns the vendored whatsapp-web.js Client.
 *
 * Responsibilities:
 *   - launch / shutdown the underlying Client
 *   - attach event listeners (QR, auth, ready, disconnect)
 *   - normalize state changes into wa-engine events
 *   - execute send jobs (called by the scheduler)
 *   - re-inject window.WWebJS if lost due to SPA navigation
 *
 * This is the ONLY module that touches the whatsapp-web.js Client API.
 */

import WAWebJS from '../index.js';
import fs from 'node:fs';
import type { EngineConfig, Job } from './types';
import type { SendFn } from './scheduler';
import { stateStore } from './state-store';
import { eventBus } from './event-bus';

const { Client, LocalAuth, MessageMedia, Events, MessageAck } = WAWebJS;

let client: InstanceType<typeof Client> | null = null;
let config: EngineConfig | null = null;

// Generation counter to prevent stale initialize() callbacks from
// resurrecting state after a shutdown.
let launchGeneration = 0;

// Track whether the browser-disconnected watchdog has been attached
// to prevent duplicate listener accumulation on reconnect.
let watchdogAttached = false;

export function configure(cfg: EngineConfig): void {
    config = cfg;
}

export async function launch(): Promise<void> {
    if (!config) throw new Error('WhatsApp client not configured — call configure() first');
    if (client) return;

    const cfg = config;
    const gen = ++launchGeneration;
    fs.mkdirSync(cfg.dataDir, { recursive: true });

    stateStore.setEngine('INITIALIZING');
    stateStore.setBrowser('launching');
    stateStore.setAuth('logged_out');

    const c = new Client({
        authStrategy: new LocalAuth({ dataPath: cfg.dataDir }),
        puppeteer: {
            headless: true,
            args: cfg.puppeteerArgs,
        },
        authTimeoutMs: cfg.authTimeoutMs ?? 120000,
    });

    watchdogAttached = false; // Reset for this launch
    attachListeners(c, gen);
    client = c;

    try {
        // Await initialization. A second engine action must never be allowed
        // to race this browser launch for the permanent Chromium profile.
        await c.initialize();
        // Guard: if a newer launch or a shutdown happened, ignore this.
        if (gen !== launchGeneration || client !== c) return;
        stateStore.setBrowser('running');
        eventBus.emit({ type: 'BrowserLaunched', at: Date.now() });
    } catch (err: unknown) {
        // Guard: if a newer launch happened, don't corrupt state.
        if (gen !== launchGeneration || client !== c) return;
        const msg = err instanceof Error ? err.message : String(err);
        stateStore.setEngine('ERROR');
        stateStore.setBrowser('crashed');
        stateStore.setError(`initialize failed: ${msg}`);
        eventBus.emit({ type: 'BrowserCrashed', at: Date.now(), error: msg });
        client = null;
        // Preserve Chromium's profile-lock diagnostic for the caller. It is
        // the required signal that another process still owns this profile.
        throw err;
    }
}

export async function shutdown(): Promise<void> {
    // Increment generation so any in-flight initialize().then() is ignored.
    launchGeneration++;
    if (client) {
        try { await client.destroy(); } catch { /* best-effort */ }
        client = null;
    }
    watchdogAttached = false;
    stateStore.setBrowser('stopped');
    stateStore.setEngine('STOPPED');
    stateStore.setAuth('logged_out');
    stateStore.setQr(null);
    stateStore.setAccount(null);
    eventBus.emit({ type: 'EngineStopped', at: Date.now() });
}

export async function logout(): Promise<void> {
    launchGeneration++;
    if (client) {
        try { await client.logout(); } catch { /* best-effort */ }
        client = null;
    }
    watchdogAttached = false;
    stateStore.setAuth('logged_out');
    stateStore.setQr(null);
    stateStore.setAccount(null);
    stateStore.setEngine('DISCONNECTED');
}

function attachListeners(c: InstanceType<typeof Client>, gen: number): void {
    c.on(Events.QR_RECEIVED, (qr: string) => {
        if (gen !== launchGeneration) return;
        stateStore.setQr(qr);
        stateStore.setEngine('AUTHENTICATING');
        stateStore.setAuth('pending_qr');
        eventBus.emit({ type: 'QrUpdated', at: Date.now(), qr });
    });

    c.on(Events.LOADING_SCREEN, () => {
        if (gen !== launchGeneration) return;
        stateStore.setEngine('AUTHENTICATING');
    });

    c.on(Events.AUTHENTICATED, () => {
        if (gen !== launchGeneration) return;
        stateStore.setQr(null);
        stateStore.setAuth('authenticated');
        eventBus.emit({ type: 'Authenticated', at: Date.now() });
    });

    c.on(Events.AUTHENTICATION_FAILURE, (msg: unknown) => {
        if (gen !== launchGeneration) return;
        stateStore.setEngine('ERROR');
        stateStore.setAuth('failed');
        const err = `auth_failure: ${String(msg)}`;
        stateStore.setError(err);
        eventBus.emit({ type: 'AuthFailed', at: Date.now(), error: err });
    });

    c.on(Events.READY, async () => {
        if (gen !== launchGeneration) return;

        try {
            const v = await c.getWWebVersion();
            if (gen !== launchGeneration) return;
            stateStore.setWwebVersion(v);
        } catch { /* non-fatal */ }

        const info = (c as unknown as { info?: WAWebJS.ClientInfo }).info;
        if (info) {
            const wid = info.wid as unknown as { _serialized?: string } | string;
            const widStr = typeof wid === 'string'
                ? wid
                : wid?._serialized ?? String(wid);
            stateStore.setAccount({
                wid: widStr,
                pushname: info.pushname ?? null,
                platform: info.platform ?? null,
            });
        }

        stateStore.setQr(null);
        stateStore.setEngine('READY');
        eventBus.emit({ type: 'EngineReady', at: Date.now() });

        // Attach the browser-disconnected watchdog ONCE per launch.
        // Don't re-attach on subsequent ready events (SPA re-injects).
        if (!watchdogAttached && c.pupBrowser) {
            watchdogAttached = true;
            // Note: Puppeteer's Browser extends a custom EventEmitter that
            // does NOT have setMaxListeners(). There is no listener cap —
            // the watchdogAttached guard prevents duplicate listeners.
            c.pupBrowser.on('disconnected', () => {
                if (gen !== launchGeneration) return;
                if (stateStore.engine !== 'STOPPED') {
                    stateStore.setEngine('DISCONNECTED');
                    stateStore.setBrowser('crashed');
                    stateStore.setError('browser disconnected');
                    eventBus.emit({ type: 'BrowserCrashed', at: Date.now(), error: 'disconnected' });
                    client = null;
                    watchdogAttached = false;
                }
            });
        }
    });

    c.on(Events.STATE_CHANGED, (newState: string) => {
        if (gen !== launchGeneration) return;
        if (newState === 'UNPAIRED' || newState === 'UNPAIRED_IDLE' || newState === 'TIMEOUT') {
            stateStore.setEngine('AUTHENTICATING');
            stateStore.setAuth('pending_qr');
        }
    });

    c.on(Events.DISCONNECTED, (reason: string) => {
        if (gen !== launchGeneration) return;
        stateStore.setEngine('DISCONNECTED');
        stateStore.setError(`disconnected: ${reason}`);
        eventBus.emit({ type: 'Disconnected', at: Date.now(), reason });
        client = null;
        watchdogAttached = false;
    });
}

/**
 * Ensure window.WWebJS is still injected. WhatsApp Web sometimes does SPA
 * navigations that clear window.WWebJS, causing sendMessage to fail.
 */
async function ensureInjected(c: InstanceType<typeof Client>): Promise<boolean> {
    if (!c.pupPage) return false;
    try {
        const injected = await c.pupPage.evaluate(() => {
            const w = window as unknown as { WWebJS?: { getChat?: unknown } };
            return typeof w.WWebJS !== 'undefined' &&
                typeof w.WWebJS.getChat === 'function';
        });
        if (injected) return true;
        await c.inject();
        return await c.pupPage.evaluate(() => {
            const w = window as unknown as { WWebJS?: { getChat?: unknown } };
            return typeof w.WWebJS !== 'undefined' &&
                typeof w.WWebJS.getChat === 'function';
        });
    } catch {
        return false;
    }
}

/**
 * The send function — called by the scheduler for each job.
 * Throws on failure so the scheduler can handle retries.
 */
export const sendFn: SendFn = async (job: Job) => {
    // Snapshot the client reference to avoid null dereference
    // if a disconnect fires between the check and the evaluate.
    const c = client;
    if (!c) throw new Error('engine-not-initialized');
    if (stateStore.engine !== 'READY') throw new Error(`engine-not-ready (state: ${stateStore.engine})`);
    if (!c.pupPage) throw new Error('page-not-available');

    const injected = await ensureInjected(c);
    if (!injected) throw new Error('injection-lost');

    // Register the recipient number (queryWidExists) so WhatsApp Web can
    // create the chat on the fly for numbers not in the chat list.
    const registered = await c.pupPage.evaluate(
        async (chatId: string) => {
            try {
                const wid = window.require('WAWebWidFactory').createWid(chatId);
                const result = await window
                    .require('WAWebQueryExistsJob')
                    .queryWidExists(wid);
                return !!(result && result.wid !== undefined);
            } catch {
                return false;
            }
        },
        job.chatId,
    );
    if (!registered) throw new Error(`number-not-registered: ${job.chatId}`);

    const data = job.file.toString('base64');
    const media = new MessageMedia(job.mimetype, data, job.filename);

    const sent = await c.sendMessage(job.chatId, media, {
        caption: job.caption,
    });
    if (!sent) {
        throw new Error(`send-failed: sendMessage returned null for ${job.chatId}`);
    }

    const sentId = sent.id as unknown as { _serialized?: string; toString?: () => string } | undefined;
    const messageId = sentId?._serialized ??
        (sentId?.toString ? sentId.toString() : String(sent.id ?? ''));
    const ack = sent.ack ?? MessageAck.ACK_PENDING;

    return { messageId, ack };
};
