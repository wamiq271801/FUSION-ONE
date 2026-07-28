'use client';
import { useEffect, useState } from 'react';
import type { WhatsAppDiagnostics, WhatsAppState } from '@/lib/whatsapp/types';

export function useWhatsAppPlatform() {
  const [platform, setPlatform] = useState<{ state: WhatsAppState | null; diagnostics: WhatsAppDiagnostics | null }>({ state: null, diagnostics: null });
  useEffect(() => { const source = new EventSource('/api/whatsapp/events'); source.addEventListener('state', event => { const next = JSON.parse((event as MessageEvent).data); setPlatform(next); }); return () => source.close(); }, []);
  return platform;
}
