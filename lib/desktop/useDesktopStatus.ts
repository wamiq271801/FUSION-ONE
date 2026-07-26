'use client';

import { useEffect, useState } from 'react';
import {
  getDesktopStatusClient,
  isDesktop,
  type DesktopStatusState,
  type DesktopServiceStatus,
  type DesktopServiceState,
  type WaSession,
} from './index';

const INITIAL: DesktopStatusState = { link: 'idle', snapshot: null };

/**
 * Subscribe to the realtime desktop supervisor status (snapshot + events).
 *
 * This is the single, clean consumption point for service-level runtime status
 * inside the web app. It replaces any polling of desktop/runtime status — the
 * underlying transport is a persistent WebSocket fed by the WinUI supervisor.
 *
 * Outside the desktop app it stays inert (`isDesktopApp` false, snapshot null).
 */
export function useDesktopStatus() {
  const [state, setState] = useState<DesktopStatusState>(INITIAL);

  useEffect(() => {
    if (!isDesktop()) return;
    const client = getDesktopStatusClient();
    const unsubscribe = client.subscribe(setState);
    return unsubscribe;
  }, []);

  const services = state.snapshot?.services ?? {};
  const web: DesktopServiceStatus | null = services['web'] ?? null;
  const wa:  DesktopServiceStatus | null = services['wa'] ?? null;
  const waSession: WaSession | null = wa?.session ?? null;

  const webState: DesktopServiceState = web?.state ?? 'UNKNOWN';
  const waState:  DesktopServiceState = wa?.state ?? 'UNKNOWN';

  return {
    /** True when this build is running inside the desktop host. */
    isDesktopApp: isDesktop(),
    /** Status-channel connectivity ('connected' = receiving live updates). */
    link: state.link,
    /** Whether the desktop supervisor reports itself available. */
    desktopAvailable: state.snapshot?.desktop.available ?? false,
    /** Full snapshot (or null before first connect). */
    snapshot: state.snapshot,
    /** Build metadata reported by the host. */
    build: state.snapshot?.build ?? null,

    web,
    wa,
    waSession,
    webState,
    waState,

    /** Convenience flags. */
    webReady: webState === 'READY',
    waReady:  waState === 'READY',
    waDegraded: waState === 'DEGRADED' || waState === 'CRASHED',
  };
}
