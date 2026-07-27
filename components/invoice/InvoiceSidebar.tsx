'use client';

/**
 * InvoiceSidebar — shared right sidebar with metadata + actions.
 *
 * Renders invoice metadata, primary PDF actions, and module-specific
 * action slots via children.
 */
import { type ReactNode } from 'react';
import {
  Printer, FileDown, Share2,
} from 'lucide-react';

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
  /** Kept for API compatibility — no longer used */
  pdfPath?: string | null;

  // ── Action handlers ─────────────────────────────────────────
  onPrint: () => void;
  onShare: () => void;
  onExport: () => void;
  /** No-op, kept for API compatibility */
  onRegenerate?: () => void;
  /** No-op, kept for API compatibility */
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
  invoiceId: _invoiceId,
  type: _type,
  billNumber: _billNumber,
  date: _date,
  party: _party,
  status: _status = 'active',
  template: _template,
  pdfPath: _pdfPath,
  onPrint,
  onShare,
  onExport,
  onRegenerate: _onRegenerate,
  onOpenFileLocation: _onOpenFileLocation,
  isRegenerating: _isRegenerating = false,
  isSendingWa = false,
  isPdfGenerating = false,
  children,
}: InvoiceSidebarProps) {
  return (
    <div className="w-full space-y-3 pb-8 print:hidden">
      {/* ── Primary Actions ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 px-0.5 mb-1">Actions</p>
        <SidebarButton icon={Printer} label="Print" onClick={onPrint} variant="primary" />
        <SidebarButton
          icon={Share2}
          label={isSendingWa ? 'Sending…' : 'Share'}
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
