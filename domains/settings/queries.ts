/**
 * Settings — data queries.
 * Store profile data fetching, extracted from app/settings/page.tsx.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/platform/supabase/client';

export const settingsKeys = {
  store: (userId: string) => ['settings-store', userId] as const,
};

export function useStoreSettings(userId: string | undefined) {
  return useQuery({
    queryKey: settingsKeys.store(userId ?? ''),
    enabled:  !!userId,
    queryFn:  async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('store')
        .select('*')
        .eq('owner_user_id', userId)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
