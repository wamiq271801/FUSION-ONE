'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/platform/supabase/client';
import { useSession } from '@/shared/providers/SessionProvider';
import { defaultDeliverySettings, type DeliverySettings } from '@/domains/invoice/delivery';

export const deliverySettingsKeys = {
  all: ['whatsapp-delivery-settings'] as const,
};

function mapRowToSettings(row: any): DeliverySettings {
  return {
    sale: {
      autoSend: row.auto_send_sale,
      template: row.sale_message_template,
    },
    proforma: {
      autoSend: row.auto_send_proforma,
      template: row.proforma_message_template,
    },
  };
}

export function useDeliverySettings() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: deliverySettingsKeys.all,
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<DeliverySettings> => {
      const { data, error } = await supabase
        .from('whatsapp_delivery_settings')
        .select('*')
        .eq('owner_user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return defaultDeliverySettings;
      return mapRowToSettings(data);
    },
  });

  const mutation = useMutation({
    mutationFn: async (settings: DeliverySettings) => {
      const { data: existing } = await supabase
        .from('whatsapp_delivery_settings')
        .select('id')
        .eq('owner_user_id', user!.id)
        .maybeSingle();

      const row = {
        owner_user_id: user!.id,
        auto_send_sale: settings.sale.autoSend,
        auto_send_proforma: settings.proforma.autoSend,
        sale_message_template: settings.sale.template,
        proforma_message_template: settings.proforma.template,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase
          .from('whatsapp_delivery_settings')
          .update(row)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('whatsapp_delivery_settings')
          .insert(row);
        if (error) throw error;
      }

      return settings;
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(deliverySettingsKeys.all, settings);
    },
  });

  return {
    settings: query.data ?? defaultDeliverySettings,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    save: (settings: DeliverySettings) => mutation.mutateAsync(settings),
    error: mutation.error,
  };
}
