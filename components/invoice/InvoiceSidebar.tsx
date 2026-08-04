'use client';

/**
 * InvoiceSidebar — invoice action panel.
 *
 * Renders Download PDF, Download Image, and a children slot
 * for module-specific actions (edit, cancel, convert, etc.).
 */
import { type ReactNode } from 'react';
import { FileDown, ImageDown, Loader2 } from 'lucide-react';
import { cn } from '@/shared/utils/utils';
import type { InvoiceData } from '@/domains/invoice/types';
import { InvoiceWhatsAppShare } from './InvoiceWhatsAppShare';
import { isDeliverableInvoice } from '@/domains/invoice/delivery';

// ── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceSidebarProps {
  onDownloadPdf: () => void;
  onDownloadPng: () => void;
  isPdfLoading?: boolean;
  isPngLoading?: boolean;
  invoiceData?: InvoiceData;
  children?: ReactNode;
}

// ── Action Button ─────────────────────────────────────────────────────────────

export function SidebarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  variant = 'default',
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary';
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary'
          ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50',
      )}
    >
      {loading
        ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        : <Icon className="h-3.5 w-3.5 shrink-0" />
      }
      {label}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function InvoiceSidebar({
  onDownloadPdf,
  onDownloadPng,
  isPdfLoading = false,
  isPngLoading = false,
  invoiceData,
  children,
}: InvoiceSidebarProps) {
  return (
    <div className="w-full space-y-3 pb-8 print:hidden">
      {/* ── Export Actions ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-sm">
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 px-0.5 mb-1">Export</p>
        <SidebarButton
          icon={FileDown}
          label={isPdfLoading ? 'Generating…' : 'Download PDF'}
          onClick={onDownloadPdf}
          loading={isPdfLoading}
          variant="primary"
        />
        <SidebarButton
          icon={ImageDown}
          label={isPngLoading ? 'Generating…' : 'Download Image'}
          onClick={onDownloadPng}
          loading={isPngLoading}
        />
      </div>
      {invoiceData && isDeliverableInvoice(invoiceData.type) && <InvoiceWhatsAppShare data={invoiceData} />}

      {/* ── Module-specific slot ── */}
      {children && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-sm">
          {children}
        </div>
      )}
    </div>
  );
}
