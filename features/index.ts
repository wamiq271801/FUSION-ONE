/**
 * Features barrel export.
 *
 * Each feature module encapsulates the queries, mutations, types and
 * business-logic helpers for a single domain. Pages import from here
 * instead of inlining Supabase logic.
 *
 * Usage:
 *   import { useSalesPageData, cancelSale } from '@/features/sales';
 *   import { useDashboardData }             from '@/features/dashboard';
 */
export * from './sales';
export * from './purchases';
export * from './proformas';
export * from './inventory';
export * from './accounts';
export * from './parties';
export * from './financial-years';
export * from './dashboard';
export * from './settings';
