'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/platform/supabase/client';
import { useSession } from '@/shared/providers/SessionProvider';

/**
 * Single source of truth for WhatsApp delivery configuration (auto-send flag +
 * message template per invoice type). Loaded exclusively from the
 * `whatsapp_settings` table. There is deliberately NO hardcoded template
 * fallback: when a template is missing from the database, `template` is `null`
 * and callers must fail with a clear error rather than invent a default.
 */
export interface WhatsAppDeliveryTypeConfig {
  autoSend: boolean;
  template: string | null;
}

export interface WhatsAppDeliverySettings {
  sale: WhatsAppDeliveryTypeConfig;
  purchase: WhatsAppDeliveryTypeConfig;
  proforma: WhatsAppDeliveryTypeConfig;
}

const EMPTY: WhatsAppDeliverySettings = {
  sale: { autoSend: false, template: null },
  purchase: { autoSend: false, template: null },
  proforma: { autoSend: false, template: null },
};

export function useWhatsAppDeliverySettings() {
  const { user } = useSession();

  const query = useQuery({
    queryKey: ['whatsapp-delivery-settings', user?.id],
    enabled: !!user?.id,
    staleTime: 1000 * 30,
    queryFn: async (): Promise<WhatsAppDeliverySettings> => {
      const { data, error } = await supabase
        .from('whatsapp_settings')
        .select(
          'auto_send_sale, auto_send_purchase, auto_send_proforma, sale_message_template, purchase_message_template, proforma_message_template',
        )
        .eq('owner_user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return EMPTY;

      return {
        sale: { autoSend: Boolean(data.auto_send_sale), template: data.sale_message_template || null },
        purchase: { autoSend: Boolean(data.auto_send_purchase), template: data.purchase_message_template || null },
        proforma: { autoSend: Boolean(data.auto_send_proforma), template: data.proforma_message_template || null },
      };
    },
  });

  return {
    settings: query.data ?? EMPTY,
    isLoading: query.isLoading,
    error: query.error,
  };
}
