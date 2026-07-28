'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/platform/supabase/client';
import { useAuth } from '@/shared/providers/AuthProvider';

export interface FinancialYear {
  id: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'closed';
}

interface FinancialYearContextType {
  financialYears: FinancialYear[];
  selectedYear: FinancialYear | null;
  setSelectedYearId: (id: string) => void;
  isReadOnly: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const FinancialYearContext = createContext<FinancialYearContextType>({
  financialYears: [],
  selectedYear: null,
  setSelectedYearId: () => {},
  isReadOnly: true,
  isLoading: true,
  refresh: async () => {},
});

export const useFinancialYear = () => useContext(FinancialYearContext);

export function FinancialYearProvider({ children }: { children: React.ReactNode }) {
  const { user, isOwner } = useAuth();
  const userId = user?.id ?? null;
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedYearId, setSelectedYearIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use a ref to track the current selected ID without causing dependency loops in fetch
  const selectedYearIdRef = React.useRef<string | null>(null);
  // Track first load so subsequent refreshes don't flash isLoading
  const hasLoadedRef = React.useRef(false);

  const loadFinancialYears = useCallback(async () => {
    if (!userId || !isOwner) {
      setIsLoading(false);
      return;
    }

    // Only show the loading indicator on the very first load.
    // Subsequent refreshes run silently so pages don't flash skeletons.
    if (!hasLoadedRef.current) {
      setIsLoading(true);
    }

    try {
      const [{ data: store }, { data: fys, error: fysErr }] = await Promise.all([
        supabase
          .from('store')
          .select('active_financial_year_id')
          .limit(1)
          .maybeSingle(),
        supabase
          .from('financial_years')
          .select('id, start_date, end_date, status')
          .order('start_date', { ascending: false }),
      ]);

      if (fysErr) throw fysErr;

      const years = fys || [];
      setFinancialYears(years);

      let currentId = selectedYearIdRef.current;
      if (!currentId) {
        if (store?.active_financial_year_id) {
          currentId = store.active_financial_year_id;
        } else if (years.length > 0) {
          const activeYear = years.find((y) => y.status === 'active');
          currentId = activeYear ? activeYear.id : years[0].id;
        }
      }

      // Check if it still exists
      const matched = years.find(y => y.id === currentId);
      if (matched) {
        selectedYearIdRef.current = matched.id;
        setSelectedYearIdState(matched.id);
      } else {
        selectedYearIdRef.current = null;
        setSelectedYearIdState(null);
      }
    } catch (err) {
      console.error('Failed to load financial years', err);
    } finally {
      hasLoadedRef.current = true;
      setIsLoading(false);
    }
  // Depend on userId (stable string) instead of the user object reference,
  // which Supabase recreates on token refresh / tab focus.
  }, [userId, isOwner]);

  useEffect(() => {
    loadFinancialYears();
  }, [loadFinancialYears]);

  const setSelectedYearId = (id: string) => {
    selectedYearIdRef.current = id;
    setSelectedYearIdState(id);
  };

  const selectedYear = financialYears.find(y => y.id === selectedYearId) || null;
  const isReadOnly = selectedYear?.status === 'closed';

  return (
    <FinancialYearContext.Provider
      value={{
        financialYears,
        selectedYear,
        setSelectedYearId,
        isReadOnly,
        isLoading,
        refresh: loadFinancialYears,
      }}
    >
      {children}
    </FinancialYearContext.Provider>
  );
}
