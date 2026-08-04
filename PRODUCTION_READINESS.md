# PRODUCTION_READINESS.md

> Phase 5 — Production Readiness & Reliability
>
> This document reports the production readiness audit results, the fixes
> applied, and operational guidance for deploying the FUSION-ONE + wa-engine
> system to production.

---

## Reliability Report

### Issues Found and Fixed

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| C3 | CRITICAL | Duplicate `Events.READY` listener caused accumulating `pupBrowser.on('disconnected')` on every reconnect | Consolidated into single handler; added `watchdogAttached` guard. NOTE: an earlier fix attempted `pupBrowser.setMaxListeners(20)`, but Puppeteer 24.x's `Browser` extends a custom EventEmitter that has no `setMaxListeners()` method (it threw `TypeError: pupBrowser.setMaxListeners is not a function`). That call was removed entirely; the `watchdogAttached` boolean guard alone prevents duplicate listener registration. |
| H1 | HIGH | `initialize().then()` resurrected state after `shutdown()` | Added `launchGeneration` counter; stale callbacks bail if gen doesn't match |
| H2 | HIGH | `client = null` race during in-flight `sendFn` | Snapshotted client reference at start of `sendFn`; all subsequent references use the snapshot |
| H3 | HIGH | No timeout on `evaluate` / `sendMessage` | (Known limitation — documented; 60s outer timeout in `deliver()` provides a safety net) |
| H4 | HIGH | SSE listener leak on unclean client disconnect | Added try/catch around `controller.enqueue`; `closed` flag; cleanup on error |
| H5 | HIGH | SSE route had no auth | Added `WHATSAPP_INTERNAL_API_KEY` check |
| H6 | HIGH | Pending jobs never evicted (unbounded memory growth) | Extended `evictOldJobs` to evict pending jobs older than `2 × jobTtlMs` |
| H7 | HIGH | Messages route used `require()` inside handler | Hoisted to top-level `import`; added `@internal/whatsapp-web.js` alias |
| M1 | MEDIUM | Concurrent `restart()` calls race | Added `restartPromise` guard — concurrent callers return the same promise |
| M2 | MEDIUM | `process.once` signal handlers don't handle repeated signals | Changed to `process.on` with `cleanupDone` guard |
| M3 | MEDIUM | Retry `setTimeout` not tracked or cancelled on shutdown | Added `retryTimers` Set; `stop()` clears all pending retry timers |
| M4 | MEDIUM | `activeCount` not decremented if `markJobStarted` throws | Wrapped synchronous prefix in try/catch with `activeCount--` in catch |
| M6 | MEDIUM | Event bus history retained full snapshots (memory leak) | Removed `history` and `recent()` entirely — they were unused |
| M7 | MEDIUM | Synchronous listener iteration blocked event loop | (Known limitation — current listener count is low; documented) |
| M9 | MEDIUM | Watchdog only fired for `READY` state | Guard changed to fire for all states except `STOPPED` |
| M16 | MEDIUM | HMR orphans Chromium in dev | Engine singleton hoisted to `globalThis.__waEngine` |

### Issues Acknowledged (Not Fixed in This Phase)

| # | Severity | Issue | Why deferred |
|---|----------|-------|-------------|
| C1 | CRITICAL | Multi-process singleton collision | Requires architectural decision: sidecar worker or file lock. Documented as operational constraint. |
| C2 | CRITICAL | Startup failures swallowed silently | Fixed: `instrumentation.ts` now logs the error. Retry logic deferred (requires backoff policy). |
| M5 | MEDIUM | O(n²) queue operations | Current job counts are low (<100). Optimization deferred until needed. |
| M8 | MEDIUM | Injection loss doesn't trigger auto-restart | Complex to implement safely. `ensureInjected` attempts re-injection; if it fails, the job fails and retries. |
| M10 | MEDIUM | No CSRF / size check on delivery route | Acceptable for internal app behind Supabase Auth. |
| M11 | MEDIUM | Busy-wait polling for job completion | Documented as technical debt. Event-based solution planned. |
| M12 | MEDIUM | Messages route doesn't normalize phone | Test-only route; delivery path normalizes correctly. |
| M13 | MEDIUM | Validate route accepts non-Indian numbers | Inconsistency noted; both paths use the same wa-engine client. |
| M14 | MEDIUM | SSE hook has no reconnection feedback | `EventSource` auto-reconnects natively. Adding reconnect state is a UX enhancement. |
| M15 | MEDIUM | Contacts route returns all chats | Test-only route; not used in the invoice pipeline. |

---

## Security Report

| Concern | Status |
|---------|--------|
| SSE endpoint auth | ✓ Fixed — checks `WHATSAPP_INTERNAL_API_KEY` (if set) |
| API key env var | Optional — if unset, all routes are open (documented) |
| Secrets in env | ✓ `NEXT_PUBLIC_SUPABASE_*` are public keys; `SUPABASE_SERVICE_ROLE_KEY` is server-only |
| Session storage | ✓ permanent profile in the OS app-data dir (Windows: `%APPDATA%/FUSION ONE/whatsapp/session`); never copied/synced/backed up |
| Browser launch params | ✓ `--no-sandbox`, `--disable-setuid-sandbox` (required in containers) |
| Logging | ✓ No PII, no session tokens, no auth secrets in logs |
| Input validation | ✓ Delivery route validates `invoice.bill_number`, `to`, `caption` |
| Module resolution | ✓ Fixed: `@internal/whatsapp-web.js` alias added to tsconfig + next.config |

### Operational Security Recommendations

1. **Set `WHATSAPP_INTERNAL_API_KEY`** in production to protect `/api/whatsapp/*` routes.
2. **Run behind HTTPS** — the SSE stream transmits QR codes and account info.
3. **Restrict Supabase RLS** — the `is_owner()` function assumes a single store per user.
4. **Monitor the session directory** (`%APPDATA%/FUSION ONE/whatsapp/session` on Windows) — it contains the WhatsApp session. If compromised, the attacker can send messages as your account.
5. **Do not expose `SUPABASE_SERVICE_ROLE_KEY`** to the client. It bypasses RLS.

---

## Known Limitations

1. **Single-process only.** The wa-engine singleton uses a single Chromium process. Multiple Node.js processes will collide on the same session directory. Deploy as a single-process server or use a sidecar worker.

2. **WhatsApp Web boot timeout.** The `authTimeoutMs` is 120s. In slow networks, this may be exceeded. Increase in `deliveryService.start()` if needed.

3. **No job persistence.** Jobs live in memory. On process restart, pending jobs are lost. (Terminal jobs are auto-evicted after 5 minutes.)

4. **No multi-account support.** One engine, one WhatsApp account, one Chromium.

5. **Image-only delivery.** The engine sends images with captions. Text/document sending is only available through the test-message API route.

6. **Polling-based delivery completion.** The `deliver()` method polls `engine.getJob()` every 200ms. Event-based completion is planned but not yet implemented.

7. **Indian numbers only.** `normalizeIndianChatId` validates Indian mobile number format.

8. **Session expires after ~30 days.** WhatsApp Web sessions expire. The engine surfaces this via `AuthFailed` — the user must re-scan the QR.

---

## Recovery Procedures

### Browser Crash

1. The engine detects the crash via `pupBrowser.on('disconnected')`.
2. State transitions to `DISCONNECTED` / `browser: crashed`.
3. `client = null` — the next `start()` call re-launches Chromium.
4. Pending jobs are preserved in the state store; the scheduler resumes after restart.
5. **Manual action:** Click "Refresh" in the WhatsApp settings panel, or call `POST /api/whatsapp`.

### Session Expiry

1. The engine receives `AUTHENTICATION_FAILURE` from WhatsApp Web.
2. State transitions to `ERROR` / `auth: failed`.
3. **Manual action:** Click "Logout" then "Connect Account" to get a fresh QR.

### Engine Timeout

1. If `initialize()` times out (120s), state transitions to `ERROR`.
2. **Manual action:** Click "Refresh" to retry.

### Process Restart

1. `instrumentation.ts` calls `deliveryService.start()` on boot.
2. The wa-engine launches Chromium, restores the `LocalAuth` session, and transitions to `READY` (if session is valid) or emits a QR (if not).
3. Pending jobs from the previous process are lost (in-memory only).
4. The scheduler resumes processing new jobs after `READY`.

---

## Operational Recommendations

1. **Deploy as a single-process server.** Use `next start` (not cluster mode). The wa-engine singleton requires a single process.

2. **Set `WHATSAPP_INTERNAL_API_KEY`.** Generate a strong random string and set it as an environment variable. This protects all `/api/whatsapp/*` routes.

3. **Monitor the `/api/whatsapp/diagnostics` endpoint.** Set up a health check that alerts if `socketHealthy === false` or `authenticationHealthy === false`.

4. **Monitor the session directory size** (`%APPDATA%/FUSION ONE/whatsapp/session` on Windows). If it grows beyond ~500MB, Chromium is caching too much. Clear it with `engine.logout()` and re-pair.

5. **Keep the WhatsApp Web version pinned.** The vendored library pins `webVersion: '2.3000.1017054665'`. Do not update without testing — WhatsApp Web's internal module names change between versions.

6. **Ensure Chromium dependencies are installed.** On Debian/Ubuntu: `libnss3`, `libatk1.0-0`, `libatk-bridge2.0-0`, `libcups2`, `libxkbcommon0`, `libxcomposite1`, `libxdamage1`, `libxfixes3`, `libxrandr2`, `libgbm1`, `libpango-1.0-0`, `libcairo2`, `libasound2`.

7. **Use `--shm-size=1g`** in Docker to prevent Chromium crashes from insufficient shared memory.

8. **Do not back up or sync the session directory.** The session is a single permanent Chromium profile in the OS app-data directory; treat it as live browser state, not data to copy.

---

## Deployment Checklist

- [ ] `NEXT_PUBLIC_SUPABASE_URL` set
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set
- [ ] `WHATSAPP_INTERNAL_API_KEY` set (strong random string)
- [ ] `SUPABASE_BOOTSTRAP.sql` executed on a fresh Supabase project
- [ ] `SUPABASE_SEED.sql` executed (or real data migrated)
- [ ] Storage buckets `store_assets` and `documents` created
- [ ] Chromium dependencies installed (`apt-get install ...`)
- [ ] `/dev/shm` size >= 1GB (Docker: `--shm-size=1g`)
- [ ] Session directory (`%APPDATA%/FUSION ONE/whatsapp/session` on Windows) writable by the Next.js process
- [ ] Port 3000 accessible (or behind a reverse proxy)
- [ ] HTTPS termination configured (for QR code security)
- [ ] Health check monitoring `/api/whatsapp/diagnostics`

---

## Maintenance Checklist

- [ ] **Weekly:** Check `/api/whatsapp/diagnostics` for `socketHealthy` and `authenticationHealthy`
- [ ] **Weekly:** Check Chromium process count (`ps aux | grep chrome | wc -l`) — should be ~10-12; if higher, investigate leaks
- [ ] **Monthly:** Check the session directory size — if >500MB, consider clearing via `engine.logout()` and re-pairing
- [ ] **Monthly:** Check application logs for `[wa-engine]` errors
- [ ] **Quarterly:** Review `internal/whatsapp-web.js/engine/` for upstream whatsapp-web.js updates (but do not update without testing)
- [ ] **On session expiry (~30 days):** Re-scan QR via the settings panel

---

## Monitoring Recommendations

1. **Engine health:** Poll `GET /api/whatsapp/diagnostics` every 60s. Alert on:
   - `status !== 'connected'` (engine not ready)
   - `socketHealthy === false`
   - `authenticationHealthy === false`
   - `lastError` is non-null

2. **SSE stream:** Monitor EventSource connection in the browser. If the stream drops for >30s, show a "reconnecting" indicator.

3. **Queue depth:** Alert if `queue.pending > 50` — indicates the engine is backed up.

4. **Chromium memory:** Monitor RSS of the Chrome process. If it exceeds 2GB, schedule a restart.

5. **Session age:** Track when `authenticatedAt` was set. Alert at 25 days to proactively re-pair before expiry.

---

*End of Phase 5 — Production Readiness Report.*
