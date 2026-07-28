'use client';

/**
 * InvoiceSidebar — shared right sidebar with metadata + actions.
 *
 * Replaces the duplicated floating bottom action bar.
 * Renders invoice metadata, primary PDF actions, and module-specific
 * action slots via children.
 */
import { useState, type ReactNode } from 'react';
import {
  Printer, FileDown, Share2, RefreshCw, FolderOpen,
} from 'lucide-react';
import { isDesktop } from '@/lib/desktop';

// ── Types ───────────────────────────────────────────────────────────────────

interface InvoiceSidebarProps {
  /** Invoice record ID */
  invoiceId: string;
  /** Invoice type */
  type: 'sale' | 'purchase' | 'proforma';
  /** Display metadata */
  billNumber: string;
  date: string;
  party?: { name?: string; number?: string } | null;
  status?: string;
  template?: string | null;
  /** Stored PDF relative path (null = no PDF stored) */
  pdfPath: string | null;

  // ── Action handlers ─────────────────────────────────────────
  onPrint: () => void;
  onShare: () => void;
  onExport: () => void;
  onRegenerate: () => void;
  onOpenFileLocation?: () => void;

  // ── Loading states ──────────────────────────────────────────
  isRegenerating?: boolean;
  isSendingWa?: boolean;
  isPdfGenerating?: boolean;

  // ── Module-specific actions slot ────────────────────────────
  children?: ReactNode;
}



// ── Sidebar Button ──────────────────────────────────────────────────────────

function SidebarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  variant = 'default',
  loading,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary';
  loading?: boolean;
}) {
  const base = 'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const styles = variant === 'primary'
    ? `${base} bg-indigo-600 text-white hover:bg-indigo-700`
    : `${base} bg-white border border-slate-200 text-slate-700 hover:bg-slate-50`;

  return (
    <button onClick={onClick} disabled={disabled || loading} className={styles}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${loading ? 'animate-spin' : ''}`} />
      {label}
    </button>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function InvoiceSidebar({
  invoiceId,
  type,
  billNumber,
  date,
  party,
  status = 'active',
  template,
  pdfPath,
  onPrint,
  onShare,
  onExport,
  onRegenerate,
  onOpenFileLocation,
  isRegenerating = false,
  isSendingWa = false,
  isPdfGenerating = false,
  children,
}: InvoiceSidebarProps) {
  const typeLabels: Record<string, string> = {
    sale: 'Sale Invoice',
    purchase: 'Purchase Bill',
    proforma: 'Proforma Invoice',
  };

  const showOpenLocation = isDesktop() && !!pdfPath;

  return (
    <div className="w-full space-y-3 pb-8 print:hidden">
      {/* ── Primary Actions ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 px-0.5 mb-1">Actions</p>
        <SidebarButton icon={Printer} label="Print" onClick={onPrint} variant="primary" />
        <SidebarButton
          icon={Share2}
          label={isSendingWa ? 'Sending…' : 'Share via WhatsApp'}
          onClick={onShare}
          loading={isSendingWa}
        />
        <SidebarButton
          icon={FileDown}
          label={isPdfGenerating ? 'Saving…' : 'Export PDF'}
          onClick={onExport}
          loading={isPdfGenerating}
        />
      </div>

      {/* ── PDF Management ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 px-0.5 mb-1">PDF</p>
        <SidebarButton
          icon={RefreshCw}
          label={isRegenerating ? 'Regenerating…' : 'Regenerate PDF'}
          onClick={onRegenerate}
          loading={isRegenerating}
        />
        {showOpenLocation && onOpenFileLocation && (
          <SidebarButton
            icon={FolderOpen}
            label="Open File Location"
            onClick={onOpenFileLocation}
          />
        )}
      </div>

      {/* ── Module-Specific Actions ──────────────────────────────── */}
      {children && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-sm">
          {children}
        </div>
      )}
    </div>
  );
}

// Re-export SidebarButton for module-specific actions
export { SidebarButton };
