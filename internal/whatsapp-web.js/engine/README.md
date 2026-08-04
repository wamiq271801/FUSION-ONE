# wa-engine

> **wa-engine** is an internal, production-grade WhatsApp image-sending engine.
> It wraps a vendored, trimmed copy of [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)
> and exposes a tiny, typed public API for sending one image with an optional
> caption to an Indian mobile number through a single WhatsApp account.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Library Philosophy](#2-library-philosophy)
3. [Folder Structure](#3-folder-structure)
4. [Initialization](#4-initialization)
5. [Configuration](#5-configuration)
6. [Authentication Flow](#6-authentication-flow)
7. [QR Flow](#7-qr-flow)
8. [Session Restoration](#8-session-restoration)
9. [Browser Lifecycle](#9-browser-lifecycle)
10. [Queue System](#10-queue-system)
11. [Scheduler](#11-scheduler)
12. [State Store](#12-state-store)
13. [Event System](#13-event-system)
14. [SSE Integration Model](#14-sse-integration-model)
15. [Snapshot System](#15-snapshot-system)
16. [Image Sending Flow](#16-image-sending-flow)
17. [Optional Caption Flow](#17-optional-caption-flow)
18. [Retry Behavior](#18-retry-behavior)
19. [Recovery Behavior](#19-recovery-behavior)
20. [Browser Restart Behavior](#20-browser-restart-behavior)
21. [Public API Reference](#21-public-api-reference)
22. [Event Reference](#22-event-reference)
23. [State Reference](#23-state-reference)
24. [Error Handling](#24-error-handling)
25. [Integration Guide](#25-integration-guide)
26. [Best Practices](#26-best-practices)
27. [Limitations](#27-limitations)
28. [Troubleshooting](#28-troubleshooting)
29. [Common Mistakes](#29-common-mistakes)
30. [Lifecycle Diagrams](#30-lifecycle-diagrams)
31. [State Diagrams](#31-state-diagrams)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (browser)                                      │
│  ┌───────────────────────────────────────────────────┐   │
│  │  EventSource('/api/whatsapp/events')              │   │
│  │  ← Snapshot events (push, no polling)             │   │
│  └───────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP + SSE
┌────────────────────────▼────────────────────────────────┐
│  Next.js (thin adapter — ~30 lines of glue)               │
│  ┌───────────────────────────────────────────────────┐   │
│  │  Route Handlers (HTTP)     │ SSE endpoint          │   │
│  │  - POST /send-image        │ - GET /events         │   │
│  │  - GET  /state             │   (forwards events)   │   │
│  │  - GET  /qr                │                       │   │
│  │  - POST /jobs/*            │                       │   │
│  └────────────────┬──────────┴───────────────────────┘   │
└───────────────────┼──────────────────────────────────────┘
                    │ engine.sendImage() / engine.subscribe() / engine.getSnapshot()
┌───────────────────▼──────────────────────────────────────┐
│  wa-engine (internal/whatsapp-web.js/engine/)              │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Engine facade (singleton)                           │ │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │ │
│  │  │ State    │  │ Event Bus │  │ Job Manager      │  │ │
│  │  │ Store    │←─┤ (pub/sub) │←─┤ (create/cancel/  │  │ │
│  │  │ (truth)  │  │           │  │  retry/evict)    │  │ │
│  │  └────┬─────┘  └─────┬─────┘  └────────┬─────────┘  │ │
│  │       │              │                  │             │ │
│  │  ┌────▼─────┐  ┌─────▼─────┐  ┌────────▼─────────┐  │ │
│  │  │ Queue    │  │ Scheduler │  │ WhatsApp Client   │  │ │
│  │  │ (FIFO)   │→─┤ (dequeue  │→─┤ (launch/send/    │  │ │
│  │  │          │  │  + retry) │  │  inject/recover) │  │ │
│  │  └──────────┘  └───────────┘  └────────┬─────────┘  │ │
│  └───────────────────────────────────────┼────────────┘ │
└──────────────────────────────────────────┼───────────────┘
                                           │ Puppeteer
                                ┌──────────▼──────────┐
                                │  Chromium            │
                                │  ↓                   │
                                │  WhatsApp Web SPA    │
                                └─────────────────────┘
```

### Why this architecture

The engine owns **everything** WhatsApp-related so that the host application
is a pure transport + UI layer. This means:

- Any future application (CLI, another web framework, a cron worker) can
  use the engine without re-implementing queue, state, or browser logic.
- There is exactly **one source of truth** (the `StateStore`) — no duplicated
  state between the engine and the host.
- The host never touches Puppeteer, never manages browser lifecycle, and
  never polls. It subscribes to events and renders state.

---

## 2. Library Philosophy

1. **One job, done well.** The engine sends one image with an optional
   caption to one Indian mobile number. It is not a general-purpose WhatsApp
   SDK. Every removed feature is a feature that cannot break.

2. **The engine is the source of truth.** All state lives inside the engine.
   The host application never holds WhatsApp state — it fetches a snapshot and
   subscribes to events.

3. **Push, don't poll.** State changes flow from the engine → event bus →
   SSE stream → frontend. There are zero polling intervals anywhere in the
   stack.

4. **Preserve upstream reliability.** The vendored `whatsapp-web.js`
  `inject()`, `initialize()`, `attachEventListeners()`, and
  `_registerFramenavigatedHandler()` are byte-for-byte identical to upstream.
  The engine wraps them; it does not rewrite them.

5. **Fail loudly, recover automatically.** Errors surface via `lastError`
   in the snapshot and via dedicated events (`EngineError`, `JobFailed`,
   `BrowserCrashed`). The engine automatically re-initializes on browser
   disconnect and retries failed jobs up to `maxAttempts`.

---

## 3. Folder Structure

```
internal/whatsapp-web.js/          ← vendored library (trimmed)
├── LICENSE                         ← Apache-2.0 (upstream attribution)
├── package.json                    ← deps: puppeteer, mime, node-fetch
├── index.js                        ← vendored public surface (trimmed)
├── index.d.ts                      ← trimmed type declarations
├── src/
│   ├── Client.js                   ← trimmed (15 methods, was 87)
│   ├── authStrategies/             ← BaseAuthStrategy, NoAuth, LocalAuth
│   ├── structures/                 ← Base, Message, MessageMedia, ClientInfo
│   ├── util/
│   │   ├── Constants.js            ← trimmed enums
│   │   ├── Injected/Utils.js      ← trimmed LoadUtils (10 helpers, was 47)
│   │   ├── Puppeteer.js           ← exposeFunctionIfAbsent
│   │   ├── Util.js                 ← mergeDefault only
│   │   └── InterfaceController.js ← (unused but harmless)
│   └── webCache/                   ← WebCache, WebCacheFactory, LocalWebCache
└── engine/                         ← wa-engine (the new engine)
    ├── index.ts                    ← Engine facade (public API)
    ├── types.ts                    ← public type contract
    ├── event-bus.ts                ← typed pub/sub
    ├── state-store.ts              ← single source of truth
    ├── phone.ts                    ← Indian phone normalization
    ├── job-manager.ts              ← job lifecycle
    ├── queue.ts                    ← FIFO view of pending jobs
    ├── scheduler.ts                ← dequeue + execute + retry
    └── whatsapp-client.ts          ← owns the vendored Client
```

The host application (Next.js) lives under `src/`:

```
src/
├── app/
│   ├── api/whatsapp/
│   │   ├── state/route.ts          ← GET snapshot
│   │   ├── qr/route.ts             ← GET QR
│   │   ├── send-image/route.ts     ← POST multipart → enqueue job
│   │   ├── events/route.ts         ← GET SSE stream
│   │   └── jobs/
│   │       ├── route.ts            ← GET all jobs
│   │       ├── cancel/route.ts     ← POST cancel job
│   │       ├── retry/route.ts      ← POST retry job
│   │       ├── clear-completed/route.ts
│   │       └── clear-failed/route.ts
│   ├── layout.tsx
│   └── page.tsx                    ← demo UI (SSE consumer)
├── components/whatsapp/
│   ├── engine-state-panel.tsx
│   ├── qr-view.tsx
│   ├── send-image-form.tsx
│   └── job-list.tsx
├── lib/whatsapp/index.ts           ← thin adapter (30 lines)
└── types/engine.ts                 ← frontend type mirror
```

---

## 4. Initialization

The engine is a **singleton**. On first import of the adapter module
(`src/lib/whatsapp/index.ts`), the engine eagerly initializes:

```ts
// src/lib/whatsapp/index.ts
import { engine } from '@internal/whatsapp-engine';
void engine.initialize();  // fire-and-forget — runs in background
```

`engine.initialize()`:
1. Merges the config with defaults.
2. Configures the WhatsApp client wrapper + scheduler.
3. Starts the scheduler.
4. Starts the job-eviction timer (60s interval).
5. Launches the browser (Puppeteer + WhatsApp Web).
6. The browser loads `https://web.whatsapp.com/`, restores the LocalAuth
   session, and eventually emits `READY`.

**Safe to call multiple times** — subsequent calls are no-ops (guarded by
`this.initialized`).

---

## 5. Configuration

```ts
interface EngineConfig {
    dataDir: string;        // permanent session dir (default: %APPDATA%/FUSION ONE/whatsapp)
    concurrency: number;   // max parallel sends (default: 1 — WhatsApp Web
                            // is NOT concurrency-safe)
    maxAttempts: number;    // retry attempts per job (default: 2)
    retryDelayMs: number;   // delay between retries (default: 5000)
    puppeteerArgs: string[];// Chromium args (default: ['--no-sandbox', ...])
    jobTtlMs: number;       // evict terminal jobs after this (default: 300000)
}
```

Pass a partial config to `initialize()`:

```ts
await engine.initialize({
    maxAttempts: 3,
    retryDelayMs: 10_000,
});
```

### Why `concurrency: 1`?

WhatsApp Web's internal `addAndSendMsgToChat` is not safe under parallel
calls — concurrent sends can corrupt the in-page message collection. The
scheduler enforces serial execution by default. Do not increase
`concurrency` unless you have verified it works for your use case.

---

## 6. Authentication Flow

```
Engine.initialize()
  → whatsappClient.launch()
    → new Client({ authStrategy: new LocalAuth({ dataDir }) })
    → client.initialize()
      → Puppeteer launches Chromium
      → page.goto('https://web.whatsapp.com/')
      → inject():
          → waitForFunction('window.Debug?.VERSION')
          → waitForFunction(Socket.state not in OPENING/UNLAUNCHED/PAIRING)
          → if state === UNPAIRED || UNPAIRED_IDLE:
              → exposeFunction('onQRChangedEvent')
              → page.evaluate(QR setup code)
              → QR string emitted via 'qr' event
          → exposeFunction('onAuthAppStateChangedEvent')
          → exposeFunction('onAppStateHasSyncedEvent')
          → page.evaluate(register Backbone listeners)
          → atomic hasSynced check
  → on 'qr' event:
      stateStore.setQr(qr) → auth = 'pending_qr'
  → on 'authenticated' event:
      stateStore.setAuth('authenticated') → qr = null
  → on 'ready' event:
      → getWWebVersion()
      → read ClientInfo (wid, pushname, platform)
      → stateStore.setEngine('READY') → auth = 'authenticated'
      → emit EngineReady
```

### Why this flow works

The vendored `inject()` is identical to upstream. It handles:
- The race where `Socket.hasSynced` is already `true` before the listener
  is registered (atomic check at the end of `inject()`).
- QR refresh on `UNPAIRED_IDLE`.
- Logout detection via `framenavigated`.
- Re-injection on SPA navigation.

The engine wraps each upstream event and translates it into engine state
changes + typed events.

---

## 7. QR Flow

1. When `Socket.state` is `UNPAIRED` or `UNPAIRED_IDLE`, the vendored
   library composes a QR string from:
   - `WAWebConnModel.Conn.ref`
   - `WAWebSignalStoreApi.waSignalStore.getRegistrationInfo()`
   - `WAWebUserPrefsInfoStore.waNoiseInfo`
   - `WAWebUserPrefsMultiDevice.getADVSecretKey()`
   - `WAWebCompanionRegClientUtils.DEVICE_PLATFORM`

2. The QR string is emitted via the `qr` event.

3. The engine's listener calls `stateStore.setQr(qr)` and emits a
   `QrUpdated` event.

4. The SSE stream forwards the `QrUpdated` event to the frontend.

5. The frontend renders the QR via the `qrcode` npm package.

6. When the user scans the QR, WhatsApp Web transitions `Socket.state` to
   `CONNECTED` and fires `change:hasSynced`. This triggers
   `onAppStateHasSyncedEvent` → `authenticated` → `ready`.

7. The engine sets `qr = null` and emits `EngineReady`.

---

## 8. Session Restoration

When the engine restarts with an existing session directory (the permanent
Chromium profile under the OS application-data directory, e.g.
`%APPDATA%/FUSION ONE/whatsapp/session` on Windows):

1. `whatsappClient.launch()` preserves Chromium's profile locks. If another
   process owns the permanent profile, the original Chromium diagnostic is
   surfaced and no second profile is created.

2. `new LocalAuth({ dataDir })` sets `puppeteer.userDataDir` to the session
   directory. Chromium restores cookies, localStorage, and IndexedDB from
   disk.

3. `client.initialize()` loads WhatsApp Web. Because the session is
   restored, `Socket.state` transitions directly to `CONNECTED` (not
   `UNPAIRED`).

4. `change:hasSynced` fires → `onAppStateHasSyncedEvent` → `LoadUtils`
   injection → `attachEventListeners` → `READY`.

5. The engine sets `engine = 'READY'`, `auth = 'authenticated'`,
   `browser = 'running'`, reads `ClientInfo`, and emits `EngineReady`.

**No QR is required.** The user does not need to re-scan.

### Why stale locks must be cleaned

When the dev server restarts (e.g. after a code edit), the previous
Chromium process may not have shut down cleanly, leaving lock files in
the user-data dir. Puppeteer then refuses to launch with
`"The browser is already running for …"`. The engine deletes these
files before launch.

---

## 9. Browser Lifecycle

| State | Meaning |
|-------|---------|
| `stopped` | No browser process. Initial state after `shutdown()`. |
| `launching` | `puppeteer.launch()` has been called; waiting for Chromium to start. |
| `running` | Chromium is alive and WhatsApp Web is loaded. |
| `crashed` | Chromium disconnected unexpectedly (OOM, crash, kill -9). |

### Watchdog

On `ready`, the engine attaches a `disconnected` listener to
`pupBrowser`. If the browser disconnects while the engine is `READY`:

1. `stateStore.setEngine('DISCONNECTED')`
2. `stateStore.setBrowser('crashed')`
3. `stateStore.setError('browser disconnected')`
4. Emit `BrowserCrashed`.
5. Set `client = null` so the next `launch()` call (via `engine.restart()` / `engine.start()`) re-initializes.

---

## 10. Queue System

Every `sendImage()` call creates a **Job** and enqueues it. The queue is
a FIFO view of all `pending` jobs in the `StateStore`, sorted by
`queuedAt`.

```
sendImage() → createJob() → stateStore.setJob(job) → JobCreated event
            → queue.notifyChanged() → QueueChanged event
            → scheduler.notifyNewJob() → scheduler ticks
```

### Job states

```
pending → processing → completed
                   ↘ → failed → (retry) → pending
                   ↘ → cancelled
```

| State | Meaning |
|-------|---------|
| `pending` | In the queue, waiting for the scheduler. |
| `processing` | The scheduler dequeued it and is executing `sendFn`. |
| `completed` | `sendFn` succeeded. `messageId` and `ack` are populated. |
| `failed` | `sendFn` threw and `attempts >= maxAttempts`. |
| `cancelled` | User cancelled while `pending`. |

### Eviction

Terminal jobs (`completed`, `failed`, `cancelled`) are evicted
automatically after `jobTtlMs` (default 5 minutes). The eviction timer
runs every 60 seconds. The host can also manually evict via
`clearCompletedJobs()` / `clearFailedJobs()`.

---

## 11. Scheduler

The scheduler is the **only** component that calls `sendFn`. It owns:

- **Dequeue order:** FIFO by `queuedAt`.
- **Concurrency:** defaults to 1 (serial). Configurable but not recommended
  above 1.
- **Retry:** on failure, if `attempts < maxAttempts`, the job goes back to
  `pending` and is re-dequeued after `retryDelayMs`.
- **Pause/Resume:** `scheduler.pause()` stops dequeue; `scheduler.resume()`
  restarts. (Currently not exposed in the public API — internal only.)
- **Wake-up:** `scheduler.notifyNewJob()` is called whenever a new job is
  enqueued, causing an immediate tick (no polling delay).

### Tick loop

```
scheduler.tick():
  while (activeCount < concurrency && !paused):
    job = queue.dequeue()
    if !job: break
    executeJob(job)   // async, increments activeCount
  if queue.size() > 0:
    scheduleTick(100ms)  // check again soon
```

---

## 12. State Store

The `StateStore` is the **single source of truth**. It holds:

```ts
{
    engine: EngineState,     // STOPPED | INITIALIZING | AUTHENTICATING | READY | DISCONNECTED | ERROR
    browser: BrowserState,   // stopped | launching | running | crashed
    auth: AuthState,         // logged_out | pending_qr | authenticated | failed
    qr: string | null,
    wwebVersion: string | null,
    account: { wid, pushname, platform } | null,
    lastError: string | null,
    jobs: Map<string, Job>,
}
```

Every setter calls `scheduleSnapshot()`, which batches all synchronous
state changes in a single tick and emits **one** `Snapshot` event via the
event bus. This prevents event storms during rapid transitions (e.g. job
completion bursts).

---

## 13. Event System

The engine uses a typed event bus for **internal** communication. All
subsystems emit events; the host subscribes via `engine.subscribe()`.

```ts
const unsubscribe = engine.subscribe((event: EngineEvent) => {
    if (event.type === 'JobCompleted') {
        console.log('Sent:', event.messageId);
    }
});
// later
unsubscribe();
```

### Event ordering

- Events are emitted synchronously from the calling subsystem.
- The event bus dispatches to all listeners in subscription order.
- `Snapshot` events are batched per tick (see §12).
- Listeners that throw are caught and logged — they do not block other
  listeners.

### No duplicate events

The event bus is a single instance. The host subscribes once. The SSE
endpoint subscribes once. There is no risk of duplicate events from
multiple subscriptions unless the host explicitly subscribes multiple
times.

---

## 14. SSE Integration Model

The engine does **not** depend on Socket.IO or any WebSocket library. It
exposes events via `subscribe()`. The Next.js adapter forwards events via
**Server-Sent Events (SSE)**:

```
Engine event bus
  → engine.subscribe()
    → SSE stream.write(`data: ${JSON.stringify(event)}\n\n`)
      → frontend EventSource.onmessage
```

### Why SSE, not WebSocket?

- SSE works with standard Next.js App Router (no custom server needed).
- SSE is unidirectional (server → client), which matches the engine's
  push-only model.
- SSE auto-reconnects natively in the browser.
- No `ws` package dependency.

### Heartbeat

The SSE endpoint sends a `: heartbeat` comment every 30 seconds to keep
the connection alive through proxies.

---

## 15. Snapshot System

`engine.getSnapshot()` returns the complete current state:

```ts
interface EngineSnapshot {
    engine: EngineState;
    browser: BrowserState;
    auth: AuthState;
    qr: string | null;
    ready: boolean;
    wwebVersion: string | null;
    account: AccountInfo | null;
    lastError: string | null;
    queue: QueueStats;
    jobs: Job[];
    health: 'healthy' | 'degraded' | 'unhealthy';
}
```

The SSE stream sends a `Snapshot` event on connect (initial state) and on
every state change thereafter. The frontend stores the latest snapshot
and renders from it — no local state duplication.

### Health

| Health | Condition |
|--------|-----------|
| `healthy` | `engine === 'READY'` and `browser === 'running'` |
| `unhealthy` | `engine === 'ERROR'` |
| `degraded` | Everything else (launching, authenticating, disconnected) |

---

## 16. Image Sending Flow

```
POST /api/whatsapp/send-image
  → engine.sendImage({ phone, file, caption })
    → createJob(input, maxAttempts)
      → normalizeIndianChatId(phone)  → chatId (91XXXXXXXXXX@c.us)
      → stateStore.setJob(job)        → JobCreated event
    → scheduler.notifyNewJob()
    → return { ok: true, jobId }      ← immediate response (async)

  ... scheduler dequeues the job ...

  → markJobStarted(jobId)              → JobStarted event
  → sendFn(job):
      → ensureInjected()               (re-inject WWebJS if lost)
      → queryWidExists(chatId)         (register number in WA Web)
      → new MessageMedia(mimetype, base64, filename)
      → client.sendMessage(chatId, media, { caption })
      → return { messageId, ack }
  → markJobCompleted(jobId, messageId, ack) → JobCompleted event
```

### Why `queryWidExists`?

For numbers not in your chat list (including your own number if you've
never messaged yourself), WhatsApp Web's `findOrCreateLatestChat` throws
an invariant violation unless the number has been "queried" via
`queryWidExists` first. This step is invisible to the caller but
essential for reliability.

---

## 17. Optional Caption Flow

The caption is passed through the entire pipeline as a simple string:

```
sendImage({ caption: "hello" })
  → job.caption = "hello"
  → sendFn(job):
    → client.sendMessage(chatId, media, { caption: job.caption })
      → window.WWebJS.sendMessage(chat, '', { media, caption: 'hello' })
        → mediaOptions.caption = 'hello'
        → message.body = '' (media message, caption is separate)
```

If `caption` is `undefined` or empty, WhatsApp Web sends the image with
no caption. No special handling is needed.

---

## 18. Retry Behavior

When `sendFn` throws:

1. `markJobFailed(jobId, error, willRetry)` is called.
   - `willRetry = attempts < maxAttempts`
   - If `willRetry`: job state → `pending` (back in queue)
   - If `!willRetry`: job state → `failed`

2. A `JobFailed` event is emitted with `willRetry` flag.

3. If `willRetry`, a `JobRetrying` event is emitted with the next attempt
   number.

4. After `retryDelayMs`, the scheduler is notified and re-dequeues the
   job.

5. `incrementAttempt(jobId)` is called each time the job starts
   processing.

### What is retried

- Network errors (Puppeteer evaluate failures)
- `injection-lost` (WWebJS missing — re-injection attempted first)
- `engine-not-ready` (transient state during reconnection)

### What is NOT retried

- `invalid-chat-id` (validation happens before enqueue — the job is never
  created)
- `number-not-registered` (permanent — the number has no WhatsApp account)

---

## 19. Recovery Behavior

### Browser crash

```
pupBrowser.on('disconnected')
  → stateStore.setEngine('DISCONNECTED')
  → stateStore.setBrowser('crashed')
  → emit BrowserCrashed
  → client = null
```

The next `sendImage()` call will fail with `engine-not-ready`. Pending
jobs stay in the queue. The host can call `engine.restart()` to
re-launch the browser and resume processing.

### Page error (WhatsApp Web SPA crash)

The vendored library's `_registerFramenavigatedHandler` detects SPA
navigations and re-runs `inject()`. The engine's `ensureInjected()`
also checks for `window.WWebJS` before each send and re-injects if
missing.

### Session expiry

WhatsApp Web sessions expire after ~30 days. When this happens, the
`auth_failure` event fires:

```
Events.AUTHENTICATION_FAILURE
  → stateStore.setEngine('ERROR')
  → stateStore.setAuth('failed')
  → emit AuthFailed
```

The host should call `engine.logout()` (to clear the stale session) and
then `engine.restart()` (to trigger a fresh QR login).

---

## 20. Browser Restart Behavior

`engine.restart()`:

1. `scheduler.stop()` — stops dequeue.
2. `whatsappClient.shutdown()` — `client.destroy()`, sets `client = null`.
3. Wait 1 second (let Chromium fully exit).
4. `whatsappClient.launch()` — new Client, new Chromium, session restore.
5. `scheduler.start()` — resume dequeue.

Pending jobs are **preserved** across restart (they live in the
`StateStore`, not in the browser). After restart, the scheduler
resumes processing them.

---

## 21. Public API Reference

### `engine.initialize(config?)`

**Purpose:** Start the engine (browser + scheduler + event bus).

**Parameters:**
- `config?: Partial<EngineConfig>` — optional config overrides.

**Returns:** `Promise<void>` — resolves when initialization is kicked off
(does NOT wait for `READY` — subscribe to `EngineReady` for that).

**Errors:** Throws if called after `shutdown()` without re-init. Safe to
call multiple times (subsequent calls are no-ops).

**Side effects:** Launches Chromium, starts the scheduler, starts the
eviction timer, subscribes to process exit signals.

**Example:**
```ts
await engine.initialize({ maxAttempts: 3 });
engine.subscribe((e) => {
    if (e.type === 'EngineReady') console.log('Ready!');
});
```

---

### `engine.shutdown()`

**Purpose:** Shut down the engine and close the browser.

**Returns:** `Promise<void>`

**Side effects:** Stops scheduler, destroys Client, clears state, emits
`EngineStopped`.

**Safe to call multiple times.**

---

### `engine.restart()`

**Purpose:** Restart the engine (shutdown + re-initialize). Pending jobs
are preserved.

**Returns:** `Promise<void>`

---

### `engine.logout()`

**Purpose:** Log out the current WhatsApp account and clear the persisted
session.

**Returns:** `Promise<void>`

**Side effects:** Calls `client.logout()`, clears `account`, sets
`auth = 'logged_out'`, `engine = 'DISCONNECTED'`. The next
`initialize()` will require a fresh QR scan.

---

### `engine.sendImage(input)`

**Purpose:** Queue an image to be sent. Returns immediately with a job ID.

**Parameters:**
```ts
{
    phone: string;          // Indian mobile number (various formats accepted)
    file: Buffer | Uint8Array; // image bytes
    filename?: string;      // default: 'image'
    mimetype?: string;      // default: 'image/jpeg'
    caption?: string;       // optional caption
}
```

**Returns:** `SendImageResult` (synchronous — no await needed):
```ts
{ ok: true, jobId: string }
| { ok: false, jobId: '', error: 'invalid-chat-id', detail: string }
```

**Side effects:** Creates a job in the state store, notifies the scheduler,
emits `JobCreated` + `JobQueued` + `QueueChanged` events.

**Errors:**
- `invalid-chat-id` — phone number is not a valid Indian mobile number.

**Example:**
```ts
const result = engine.sendImage({
    phone: '9876543210',
    file: imageBuffer,
    filename: 'photo.png',
    mimetype: 'image/png',
    caption: 'Check this out!',
});
if (result.ok) {
    console.log('Queued:', result.jobId);
} else {
    console.error('Failed:', result.error, result.detail);
}
```

---

### `engine.cancelJob(jobId)`

**Purpose:** Cancel a pending job.

**Returns:** `boolean` — `true` if cancelled, `false` if not cancellable
(already processing or terminal).

**Side effects:** Sets job state to `cancelled`, emits `JobCancelled`.

---

### `engine.retryJob(jobId)`

**Purpose:** Retry a failed job.

**Returns:** `boolean` — `true` if queued for retry, `false` if not in
`failed` state.

**Side effects:** Sets job state to `pending`, emits `JobQueued`.

---

### `engine.clearCompletedJobs()`

**Returns:** `number` — count of removed jobs.

---

### `engine.clearFailedJobs()`

**Returns:** `number` — count of removed jobs.

---

### `engine.getSnapshot()`

**Returns:** `EngineSnapshot` — complete current state (synchronous).

---

### `engine.subscribe(listener)`

**Purpose:** Subscribe to engine events.

**Parameters:** `listener: (event: EngineEvent) => void`

**Returns:** `() => void` — unsubscribe function.

**Example:**
```ts
const unsub = engine.subscribe((event) => {
    if (event.type === 'JobCompleted') {
        console.log(`Job ${event.jobId} sent: ${event.messageId}`);
    }
});
// later
unsub();
```

---

## 22. Event Reference

| Event | When | Payload | Guaranteed? |
|-------|------|---------|-------------|
| `EngineStarted` | `initialize()` called | `{ at }` | Yes |
| `EngineReady` | WhatsApp Web READY | `{ at }` | Yes (on success) |
| `EngineStopped` | `shutdown()` completed | `{ at }` | Yes |
| `EngineError` | Fatal error | `{ at, error }` | Best-effort |
| `BrowserLaunched` | Chromium launched | `{ at }` | Yes |
| `BrowserClosed` | Chromium closed gracefully | `{ at }` | Yes |
| `BrowserCrashed` | Chromium disconnected unexpectedly | `{ at, error }` | Best-effort |
| `QrUpdated` | QR string received/refreshed | `{ at, qr }` | Yes (during auth) |
| `Authenticated` | WhatsApp Web authenticated | `{ at }` | Yes |
| `AuthFailed` | Authentication failed | `{ at, error }` | Yes |
| `Disconnected` | Socket disconnected | `{ at, reason }` | Yes |
| `Reconnecting` | (reserved — not currently emitted) | `{ at }` | N/A |
| `JobCreated` | Job created via `sendImage()` | `{ at, job }` | Yes |
| `JobQueued` | Job entered the queue | `{ at, jobId }` | Yes |
| `JobStarted` | Scheduler started processing | `{ at, jobId }` | Yes |
| `JobCompleted` | Send succeeded | `{ at, jobId, messageId, ack }` | Yes |
| `JobFailed` | Send failed | `{ at, jobId, error, willRetry }` | Yes |
| `JobCancelled` | Job cancelled by user | `{ at, jobId }` | Yes |
| `JobRetrying` | Job scheduled for retry | `{ at, jobId, attempt }` | Yes (on retry) |
| `QueueChanged` | Queue stats changed | `{ at, stats }` | Yes |
| `Snapshot` | Full state (batched per tick) | `{ at, snapshot }` | Yes |

### Ordering guarantees

- `JobCreated` → `JobQueued` → `JobStarted` → `JobCompleted` (or `JobFailed`).
- `QrUpdated` → `Authenticated` → `EngineReady`.
- `Snapshot` is emitted after every state change (batched per tick).
- Events from different subsystems may interleave but are always
  individually consistent.

---

## 23. State Reference

### Engine states

```
STOPPED → INITIALIZING → AUTHENTICATING → READY
                         ↗                ↓
                        ↗                 DISCONNECTED → INITIALIZING (restart)
                       ↗                        ↓
                 ERROR ←────────────── (auth_failure / init timeout)
```

| State | Meaning | Expected? |
|-------|---------|-----------|
| `STOPPED` | Engine not initialized | Yes (initial / after shutdown) |
| `INITIALIZING` | Browser launching, WhatsApp Web loading | Yes |
| `AUTHENTICATING` | Waiting for QR scan or session sync | Yes |
| `READY` | Operational — can send images | Yes (target state) |
| `DISCONNECTED` | Browser crashed or socket disconnected | Indicates a problem |
| `ERROR` | Fatal error (auth failure, init timeout) | Indicates a failure |

### Browser states

| State | Meaning |
|-------|---------|
| `stopped` | No browser process |
| `launching` | Puppeteer launching |
| `running` | Chromium alive |
| `crashed` | Chromium disconnected unexpectedly |

### Auth states

| State | Meaning |
|-------|---------|
| `logged_out` | No session / after logout |
| `pending_qr` | QR displayed, waiting for scan |
| `authenticated` | Session active |
| `failed` | Auth failure (session expired / invalid) |

### Job states

```
pending → processing → completed
                    ↘ → failed → (retry) → pending
                    ↘ → cancelled
```

---

## 24. Error Handling

### Job-level errors

`sendFn` can throw. The scheduler catches and classifies:

| Error message prefix | Meaning | Retried? |
|----------------------|---------|----------|
| `engine-not-ready` | Engine state is not `READY` | Yes (transient) |
| `engine-not-initialized` | `client` is null | Yes (transient) |
| `injection-lost` | `window.WWebJS` missing and re-injection failed | Yes |
| `number-not-registered` | `queryWidExists` returned false | No (permanent) |
| `send-failed` | `sendMessage` returned null | No (usually means number has no WhatsApp) |
| `send-exception` | Unexpected error from `sendMessage` | Yes |

### Engine-level errors

- `initialize failed: ...` — Puppeteer launch or inject timeout. Sets
  `engine = 'ERROR'`. Usually caused by stale Chromium locks or network
  issues.
- `auth_failure: ...` — Session expired or invalid. Sets `auth = 'failed'`.
  Call `logout()` + `restart()`.
- `disconnected: ...` — Socket disconnected. Sets
  `engine = 'DISCONNECTED'`. Pending jobs are preserved.

### Surface errors

All errors are surfaced via:
1. `snapshot.lastError` — the most recent error string.
2. `EngineError` / `AuthFailed` / `BrowserCrashed` events.
3. `job.error` — per-job error string.

---

## 25. Integration Guide

### Minimal integration (Next.js)

1. **Import the adapter** in any server-side module:
```ts
// src/lib/whatsapp/index.ts
import 'server-only';
import { engine } from '@internal/whatsapp-engine';
export { engine };
void engine.initialize();
```

2. **Expose HTTP endpoints** (Route Handlers):
```ts
// src/app/api/whatsapp/send-image/route.ts
import { engine } from '@/lib/whatsapp';

export async function POST(req: Request) {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const phone = formData.get('phone') as string;
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = engine.sendImage({ phone, file: bytes, mimetype: file.type });
    return Response.json(result);
}
```

3. **Expose SSE stream**:
```ts
// src/app/api/whatsapp/events/route.ts
import { engine } from '@/lib/whatsapp';

export async function GET(req: Request) {
    const stream = new ReadableStream({
        start(controller) {
            const enc = new TextEncoder();
            controller.enqueue(enc.encode(`data: ${JSON.stringify({
                type: 'Snapshot', at: Date.now(), snapshot: engine.getSnapshot()
            })}\n\n`));
            const unsub = engine.subscribe((event) => {
                controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));
            });
            req.signal.addEventListener('abort', () => { unsub(); controller.close(); });
        },
    });
    return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream' },
    });
}
```

4. **Frontend** connects via `EventSource` and renders `snapshot`.

### Non-Next.js integration

The engine is framework-agnostic. Any Node.js application can use it:

```ts
import { engine } from './internal/whatsapp-web.js/engine';

await engine.initialize(); // dataDir defaults to the OS app-data dir
// (Windows: %APPDATA%/FUSION ONE/whatsapp). Override only for a custom path.

engine.subscribe((event) => {
    if (event.type === 'EngineReady') {
        engine.sendImage({ phone: '9876543210', file: imgBuffer });
    }
});
```

---

## 26. Best Practices

### Application architecture
- The engine is a **singleton**. Do not create multiple instances.
- The host should **never** touch `client.pupPage` or `client.pupBrowser`.
- All state should come from `getSnapshot()` or events — do not cache.

### Browser lifecycle
- Call `engine.shutdown()` on process exit (the engine does this
  automatically via `SIGINT`/`SIGTERM`/`beforeExit` handlers).
- Avoid killing Chromium externally — use `engine.restart()` instead.
- If Chromium crashes, the engine sets `browser = 'crashed'` and
  `client = null`. Call `engine.restart()` to recover.

### Session persistence
- The session is a single permanent Chromium profile stored in the OS
  application-data directory (Windows: `%APPDATA%/FUSION ONE/whatsapp/session`).
  It is reused on every launch — nothing is copied, synced, imported,
  exported, or backed up.
- Do NOT delete the session directory while the engine is running.
- The engine never deletes the session automatically. Clear it only via
  `engine.logout()` (explicit user logout) — the only path that removes the
  profile.
- If the session becomes stale (auth_failure), do not delete it; the normal
  authentication flow emits a fresh QR. After a successful login the same
  directory continues to be used. Call `engine.logout()` only for an explicit
  reset.

### Queue usage
- `sendImage()` returns immediately with a `jobId`. Track progress via
  events, not by awaiting.
- Cancel jobs while they are `pending` — once `processing`, they cannot
  be cancelled.
- Clear completed/failed jobs periodically to bound memory (the engine
  auto-evicts after 5 minutes by default).

### Image handling
- Always pass the correct `mimetype` (e.g. `image/png` for PNGs). If
  omitted, the engine defaults to `image/jpeg`, which causes WhatsApp
  Web's `processMediaData` to fail for non-JPEG images.
- Keep images under ~5MB — WhatsApp Web has upload limits.
- The image bytes are held in memory while the job is `pending` or
  `processing`. For very large volumes, increase `concurrency` (at your
  own risk) or throttle externally.

### Error handling
- Subscribe to `JobFailed` events to surface send failures to the user.
- Subscribe to `EngineError` / `BrowserCrashed` to trigger alerts.
- Check `snapshot.health` — `unhealthy` means the engine cannot send.

### Recovery
- On `BrowserCrashed`, call `engine.restart()`. Pending jobs resume.
- On `AuthFailed`, call `engine.logout()` + `engine.restart()`. A new QR
  will be emitted.
- On `Disconnected`, the engine sets `client = null`. The next
  `sendImage()` will return `engine-not-ready`. Call `engine.restart()`.

### Logging
- The engine logs to `console.log` / `console.error` with `[whatsapp]`
  prefix.
- In production, pipe these to your structured logger.

### Deployment
- Run the engine in a long-lived process (server, daemon, worker). Do
  NOT use serverless (Lambda) — the browser state cannot be frozen.
- Ensure Chromium dependencies are installed:
  `apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2`
- Set `--no-sandbox` in `puppeteerArgs` (already the default) when
  running as root in a container.

### Scalability
- **One engine per process.** Multiple WhatsApp accounts require
  multiple processes (each with its own `dataDir`).
- **One WhatsApp account per engine.** Multi-account support is not
  planned.
- Throughput: ~1 send per 1-3 seconds (WhatsApp Web's `addAndSendMsgToChat`
  is the bottleneck, not the engine).

### Memory management
- Terminal jobs are auto-evicted after `jobTtlMs` (default 5 min).
- The event bus keeps a 200-event history for replay.
- The state store batches snapshot emissions to prevent event storms.

### Graceful shutdown
- The engine registers `SIGINT` / `SIGTERM` / `beforeExit` handlers.
- On shutdown: scheduler stops, browser closes, state clears.
- Pending jobs are lost on shutdown (they live in memory, not on disk).

---

## 27. Limitations

1. **Indian numbers only.** The `normalizeIndianChatId` function validates
   and normalizes to `91XXXXXXXXXX@c.us`. To support other countries,
   modify `engine/phone.ts`.

2. **One account, one browser.** The engine is a singleton. Multi-account
   requires multiple processes.

3. **No persistence.** Jobs live in memory. On engine restart, pending
   jobs are lost. (Completed/failed job history is also in-memory.)

4. **No receive.** The engine is send-only. It does not expose incoming
   messages, reactions, or any receive-side events.

5. **WhatsApp Web version pinned.** The vendored library pins
   `webVersion: '2.3000.1017054665'`. If WhatsApp Web changes its
   internal module names, the library will break. The `LocalWebCache`
   persists the pinned `index.html` to avoid auto-updates.

6. **Session expires.** WhatsApp Web sessions expire after ~30 days. The
   engine surfaces this via `AuthFailed` — the user must re-scan the QR.

7. **No concurrent sends.** `concurrency: 1` by default. WhatsApp Web's
   internal state is not safe under parallel `sendMessage` calls.

8. **Image-only.** The engine cannot send text, audio, video, documents,
   stickers, or any non-image media.

---

## 28. Troubleshooting

### Engine stuck in `INITIALIZING` / `AUTHENTICATING`

**Cause:** Usually a stale Chromium Singleton lock or a slow WhatsApp Web
load.

**Fix:**
```bash
rm -rf .wwebjs_auth/session/Singleton*
# or completely:
rm -rf .wwebjs_auth .wwebjs_cache
# then restart the engine
```

### `initialize failed: Waiting failed: 30000ms exceeded`

**Cause:** WhatsApp Web took >30s to load (slow network, slow sandbox).

**Fix:** Check network connectivity. If on a slow connection, the
default `authTimeoutMs: 0` (which internally falls back to 30000ms)
may be too short. The vendored library's `inject()` uses
`this.options.authTimeoutMs || 30000`.

### `Module not found: Can't resolve 'mime'`

**Cause:** The host's `package.json` is missing the vendored library's
runtime dependencies.

**Fix:**
```bash
npm install mime@3.0.0 node-fetch@2.7.0 puppeteer@24.38.0
```

### `send-failed: sendMessage returned null`

**Cause:** The recipient number is not registered on WhatsApp, OR the
number has never been messaged and `queryWidExists` failed.

**Fix:** Verify the recipient has an active WhatsApp account. Try
sending a text message to them manually from the WhatsApp Web UI first.

### `injection-lost`

**Cause:** WhatsApp Web did an SPA navigation that cleared
`window.WWebJS`. The engine tried to re-inject but failed.

**Fix:** Call `engine.restart()`.

### `number-not-registered`

**Cause:** `queryWidExists` returned false. The number does not have a
WhatsApp account, or WhatsApp Web's lookup service is unavailable.

**Fix:** Verify the number. If it's valid, retry — the lookup can be
transient.

### Browser crashes repeatedly

**Cause:** Out of memory, missing Chromium dependencies, or
`/dev/shm` too small.

**Fix:**
```bash
# Install Chromium deps (Debian/Ubuntu)
apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libpango-1.0-0 libcairo2 libasound2

# Increase /dev/shm size (Docker)
docker run --shm-size=1g ...
```

### Duplicate events

**Cause:** The host subscribed multiple times without unsubscribing.

**Fix:** Store the unsubscribe function and call it before re-subscribing:
```ts
let unsub: (() => void) | null = null;
function subscribe() {
    if (unsub) unsub();
    unsub = engine.subscribe(listener);
}
```

---

## 29. Common Mistakes

1. **Awaiting `sendImage()`.** It returns synchronously — the actual send
   happens in the scheduler. Track progress via `JobCompleted` events.

2. **Passing `chatId` instead of `phone`.** The API expects a raw phone
   number (e.g. `9876543210`), not a chat ID (e.g.
   `919876543210@c.us`). The engine normalizes internally.

3. **Omitting `mimetype`.** If you pass a PNG but don't specify
   `mimetype: 'image/png'`, the engine defaults to `image/jpeg`, which
   causes WhatsApp Web to fail silently.

4. **Deleting `.wwebjs_auth/` while the engine is running.** This
   corrupts the session. Always `shutdown()` first.

5. **Killing Chromium with `kill -9`.** This leaves lock files. Use
   `engine.shutdown()` or `engine.restart()` instead.

6. **Importing `@internal/whatsapp-engine` from a client component.**
   The adapter has `import 'server-only'` — it will fail at build time.
   Use the API routes + SSE for client-side access.

7. **Polling `getSnapshot()` in a loop.** Subscribe to events instead.
   The SSE stream pushes every state change.

8. **Setting `concurrency > 1`.** WhatsApp Web's internal state is not
   safe under parallel sends. Keep it at 1.

---

## 30. Lifecycle Diagrams

### Engine lifecycle

```
                    initialize()
                         │
                         ▼
                   ┌──────────┐
                   │ STOPPED  │
                   └────┬─────┘
                        │ launch()
                        ▼
                 ┌──────────────┐
                 │ INITIALIZING │◄─────── restart()
                 └──────┬───────┘           │
                        │                   │
              ┌─────────┴──────────┐        │
              │                    │        │
              ▼                    ▼        │
     ┌────────────────┐    ┌───────────┐    │
     │ AUTHENTICATING │    │   ERROR   │    │
     └───────┬────────┘    └─────┬─────┘    │
             │                   │          │
     ┌───────┴───────┐     logout()         │
     │               │         │            │
     ▼               ▼         ▼            │
 ┌────────┐    ┌──────────┐ ┌────────────┐  │
 │  READY │    │DISCONNECT│ │  STOPPED   │──┘
 └───┬────┘    └──────────┘ └────────────┘
     │
     │ browser crash
     ▼
 ┌──────────┐
 │DISCONNECT│
 └──────────┘
```

### Job lifecycle

```
 sendImage()
     │
     ▼
┌─────────┐     scheduler     ┌────────────┐
│ pending │ ──────────────► │ processing  │
└─────────┘                  └──────┬─────┘
     ▲                             │
     │ retry                       │
     │ (if attempts < max)         │
     │                             ▼
┌────┴────────┐             ┌───────────┐
│   pending   │◄───────────┤  failed   │
└─────────────┘             └───────────┘
                                  │
                                  │ (if attempts >= max)
                                  ▼
                            ┌───────────┐
                            │  failed   │ (terminal)
                            └───────────┘

  cancel (while pending)
     │
     ▼
┌───────────┐
│ cancelled │ (terminal)
└───────────┘

  sendFn success
     │
     ▼
┌───────────┐
│ completed │ (terminal)
└───────────┘
```

---

## 31. State Diagrams

### Engine state transitions

```
STOPPED ──initialize()──► INITIALIZING
INITIALIZING ──QR received──► AUTHENTICATING
INITIALIZING ──session restored──► READY
AUTHENTICATING ──scan complete──► READY
AUTHENTICATING ──auth_failure──► ERROR
READY ──browser crash──► DISCONNECTED
READY ──socket disconnect──► DISCONNECTED
DISCONNECTED ──restart()──► INITIALIZING
ERROR ──logout()+restart()──► INITIALIZING
* ──shutdown()──► STOPPED
```

### Auth state transitions

```
logged_out ──QR emitted──► pending_qr
pending_qr ──scan complete──► authenticated
authenticated ──session expired──► failed
authenticated ──logout()──► logged_out
failed ──logout()+restart()──► logged_out ──QR──► pending_qr ──► authenticated
```

---

*End of documentation.*
