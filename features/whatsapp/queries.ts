'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient }    from '@tanstack/react-query';
import { supabase }                    from '@/lib/supabase';
import { useAuth }                     from '@/components/auth/AuthProvider';
import { waKeys, WA_DEFAULT_SALE_TEMPLATE, WA_DEFAULT_PROFORMA_TEMPLATE } from './constants';
import type { WaStatus, WaBackendState, WaSettings, WaStatusResponse } from './types';

const BACKEND_URL = process.env.NEXT_PUBLIC_WA_BACKEND_URL || 'http://localhost:42069';
const API_KEY     = process.env.NEXT_PUBLIC_WA_API_KEY     || '';

function mapBackendState(backendState: string): WaStatus {
  switch (backendState) {
    case 'READY':         return 'connected';
    case 'QR_READY':      return 'qr_ready';
    case 'STARTING':
    case 'BOOTING':
    case 'AUTHENTICATED':
    case 'RESTARTING':
    case 'LOGGING_OUT':   return 'connecting';
    default:              return 'disconnected';
  }
}

function buildWsUrl(): string {
  const base = BACKEND_URL.replace(/^http/, 'ws');
  return `${base}/ws?api_key=${encodeURIComponent(API_KEY)}`;
}

// ── useWaStatus — real-time via native WebSocket ──────────────────────────────

export function useWaStatus() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [checked, setChecked] = useState(false);

  const query = useQuery<WaStatusResponse>({
    queryKey: waKeys.status(),
    queryFn:  async (): Promise<WaStatusResponse> => {
      try {
        const res = await fetch('/api/whatsapp/status');
        if (!res.ok) throw new Error();
        const data = await res.json();
        setBackendOnline(true);
        setChecked(true);
        return { ...data, backendOnline: true };
      } catch {
        setBackendOnline(false);
        setChecked(true);
        return { status: 'disconnected', state: 'DISCONNECTED', qr: null, connectedSince: null, backendOnline: false };
      }
    },
    placeholderData: { status: 'disconnected', state: 'DISCONNECTED', qr: null, connectedSince: null, backendOnline: false },
    staleTime: 5000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  useEffect(() => {
    function connectWs() {
      if (wsRef.current && wsRef.current.readyState <= 1) return;

      const ws = new WebSocket(buildWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setBackendOnline(true);
        setChecked(true);
        const current = queryClient.getQueryData<WaStatusResponse>(waKeys.status());
        if (current) {
          queryClient.setQueryData<WaStatusResponse>(waKeys.status(), { ...current, backendOnline: true });
        }
      };

      ws.onmessage = (evt) => {
        try {
          const { event, payload } = JSON.parse(evt.data);
          setBackendOnline(true);
          setChecked(true);

          switch (event) {
            case 'session.snapshot': {
              const state: WaBackendState = payload.state || 'DISCONNECTED';
              const qr = payload.qr?.value || null;
              queryClient.setQueryData<WaStatusResponse>(waKeys.status(), {
                status:         mapBackendState(state),
                state,
                qr,
                connectedSince: null,
                backendOnline:  true,
              });
              break;
            }
            case 'session.qr': {
              const prev = queryClient.getQueryData<WaStatusResponse>(waKeys.status());
              queryClient.setQueryData<WaStatusResponse>(waKeys.status(), {
                status:         'qr_ready',
                state:          'QR_READY',
                qr:             payload.qr || null,
                connectedSince: prev?.connectedSince || null,
                backendOnline:  true,
              });
              break;
            }
            case 'session.authenticated': {
              const prev = queryClient.getQueryData<WaStatusResponse>(waKeys.status());
              queryClient.setQueryData<WaStatusResponse>(waKeys.status(), {
                status:         'connecting',
                state:          'AUTHENTICATED',
                qr:             null,
                connectedSince: prev?.connectedSince || null,
                backendOnline:  true,
              });
              break;
            }
            case 'session.ready': {
              queryClient.setQueryData<WaStatusResponse>(waKeys.status(), {
                status:         'connected',
                state:          'READY',
                qr:             null,
                connectedSince: payload.connectedSince || new Date().toISOString(),
                backendOnline:  true,
              });
              break;
            }
            case 'session.disconnected': {
              queryClient.setQueryData<WaStatusResponse>(waKeys.status(), {
                status:         'disconnected',
                state:          'DISCONNECTED',
                qr:             null,
                connectedSince: null,
                backendOnline:  true,
              });
              break;
            }
            case 'session.error': {
              const prev = queryClient.getQueryData<WaStatusResponse>(waKeys.status());
              queryClient.setQueryData<WaStatusResponse>(waKeys.status(), {
                status:         'disconnected',
                state:          'ERROR',
                qr:             null,
                connectedSince: prev?.connectedSince || null,
                backendOnline:  true,
              });
              break;
            }
            // message.* and metrics.* events — no UI state change needed
          }
        } catch { /* ignore malformed messages */ }
      };

      ws.onclose = () => {
        setBackendOnline(false);
        queryClient.setQueryData<WaStatusResponse>(waKeys.status(), {
          status:         'disconnected',
          state:          'DISCONNECTED',
          qr:             null,
          connectedSince: null,
          backendOnline:  false,
        });
        // Reconnect after 3s
        reconnectTimer.current = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        // onerror is always followed by onclose, so let onclose handle reconnect
      };
    }

    connectWs();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [queryClient]);

  // Merge the live backendOnline state into the query result
  const data: WaStatusResponse = {
    ...(query.data ?? { status: 'disconnected', state: 'DISCONNECTED', qr: null, connectedSince: null, backendOnline: false }),
    backendOnline,
  };

  return { ...query, data, checked };
}

// ── useWaSettings ─────────────────────────────────────────────────────────────

export function useWaSettings() {
  const { user } = useAuth();

  return useQuery<WaSettings>({
    queryKey: waKeys.settings(),
    enabled:  !!user?.id,
    staleTime: 1000 * 60 * 5,
    queryFn:  async (): Promise<WaSettings> => {
      const { data, error } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('owner_user_id', user!.id)
        .maybeSingle();

      if (error) throw error;

      return {
        auto_send_sale:            data?.auto_send_sale            ?? false,
        auto_send_proforma:        data?.auto_send_proforma        ?? false,
        sale_message_template:     data?.sale_message_template     ?? WA_DEFAULT_SALE_TEMPLATE,
        proforma_message_template: data?.proforma_message_template ?? WA_DEFAULT_PROFORMA_TEMPLATE,
      };
    },
  });
}
