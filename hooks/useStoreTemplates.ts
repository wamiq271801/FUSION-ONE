'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/platform/supabase/client';
import { useAuth } from '@/shared/providers/AuthProvider';
import type { TemplateVariant } from '@/domains/invoice/types';

export type InvoiceType = 'sale' | 'purchase' | 'proforma';

export interface StoreTemplates {
  sale: TemplateVariant;
  purchase: TemplateVariant;
  proforma: TemplateVariant;
}

const DEFAULT_TEMPLATES: StoreTemplates = {
  sale: 'prestige',
  purchase: 'prestige',
  proforma: 'prestige',
};

export function useStoreTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['store-templates', user?.id],
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 min cache
    queryFn: async (): Promise<StoreTemplates> => {
      const { data, error } = await supabase
        .from('store')
        .select('id, invoice_templates')
        .eq('owner_user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      return {
        ...DEFAULT_TEMPLATES,
        ...(data?.invoice_templates ?? {}),
      };
    },
  });

  const mutation = useMutation({
    mutationFn: async ({
      type,
      variant,
    }: {
      type: InvoiceType;
      variant: TemplateVariant;
    }) => {
      const { data: storeData, error: fetchErr } = await supabase
        .from('store')
        .select('id, invoice_templates')
        .eq('owner_user_id', user!.id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!storeData) throw new Error('Store not found');

      const next: StoreTemplates = {
        ...DEFAULT_TEMPLATES,
        ...(storeData.invoice_templates ?? {}),
        [type]: variant,
      };

      const { error: updateErr } = await supabase
        .from('store')
        .update({ invoice_templates: next } as any)
        .eq('id', storeData.id);

      if (updateErr) throw updateErr;
      return next;
    },
    onMutate: async ({ type, variant }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['store-templates', user?.id] });
      const prev = queryClient.getQueryData<StoreTemplates>(['store-templates', user?.id]);
      queryClient.setQueryData<StoreTemplates>(['store-templates', user?.id], (old) => ({
        ...DEFAULT_TEMPLATES,
        ...(old ?? {}),
        [type]: variant,
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx: any) => {
      // Rollback on error
      if (ctx?.prev) {
        queryClient.setQueryData(['store-templates', user?.id], ctx.prev);
      }
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['store-templates', user?.id], next);
    },
  });

  const setTemplate = useCallback(
    (type: InvoiceType, variant: TemplateVariant) => {
      mutation.mutate({ type, variant });
    },
    [mutation]
  );

  return {
    templates: query.data ?? DEFAULT_TEMPLATES,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    setTemplate,
    error: mutation.error,
  };
}
