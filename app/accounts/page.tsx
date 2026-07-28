'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFinancialYear } from '@/components/providers/FinancialYearProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import {
  Plus, Edit2, Landmark, Banknote, X, Wallet,
  ArrowDownToLine, ArrowLeftRight, History,
  ArrowUpRight, ArrowDownLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useAccountsPageData,
  useAccountsInvalidation,
  computeBalances,
  getTransactionLabel,
  getTransactionColor,
  type AccountBankAccount,
  type AccountPaymentMode,
  type TransactionRow,
} from '@/features/accounts';
import { formatINR, clampToFinancialYear } from '@/features/accounts/mutations';

// ═════════════════════════════════════════════════════════════════════════════
export default function AccountsPage() {
  const { selectedYear, isReadOnly, isLoading: fyLoading } = useFinancialYear();
  const { error, success } = useToast();
  const queryClient = useQueryClient();
  const refreshAll = useAccountsInvalidation();

  // ── Account modal state ─────────────────────────────────────────────────
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountBankAccount | null>(null);
  const [accountNameInput, setAccountNameInput] = useState('');

  // ── Payment mode state ──────────────────────────────────────────────────
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);
  const [activeBankId, setActiveBankId] = useState<string | null>(null);
  const [modeNameInput, setModeNameInput] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [modeToDelete, setModeToDelete] = useState<AccountPaymentMode | null>(null);

  // ── Add Funds modal state ───────────────────────────────────────────────
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  const [addFundsAccountId, setAddFundsAccountId] = useState('');
  const [addFundsAmount, setAddFundsAmount] = useState('');
  const [addFundsDate, setAddFundsDate] = useState('');
  const [addFundsNotes, setAddFundsNotes] = useState('');
  const [isAddFundsSaving, setIsAddFundsSaving] = useState(false);

  // ── Transfer modal state ────────────────────────────────────────────────
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [isTransferSaving, setIsTransferSaving] = useState(false);

  // ── Transaction history modal state ─────────────────────────────────────
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyAccountId, setHistoryAccountId] = useState<string | null>(null);
  const [historyAccountName, setHistoryAccountName] = useState('');

  // ── Data fetching ───────────────────────────────────────────────────────
  const accountsQuery = useAccountsPageData(selectedYear, fyLoading);

  const historyQuery = useQuery({
    queryKey: ['account-history', historyAccountId, selectedYear?.id],
    enabled: isHistoryOpen && !!historyAccountId && !!selectedYear,
    queryFn: async () => {
      if (!historyAccountId || !selectedYear) return [];
      const res = await fetch(`/api/accounts/transactions?bank_account_id=${historyAccountId}&financial_year_id=${selectedYear.id}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      const data = await res.json();
      return data.transactions as TransactionRow[];
    },
  });

  const { accounts = [], paymentModes = [], transactions = [] } = accountsQuery.data || {};

  // ── Balance computation ─────────────────────────────────────────────────
  const balances = useMemo(() => computeBalances(accounts, transactions), [accounts, transactions]);

  // ═══ Account save/edit (existing) ═════════════════════════════════════
  const handleSaveAccount = async () => {
    if (!accountNameInput.trim()) { error('Validation', 'Account name required'); return; }
    try {
      if (editingAccount) {
        const { error: err } = await supabase.from('bank_accounts').update({ name: accountNameInput }).eq('id', editingAccount.id);
        if (err) throw err; success('Success', 'Account updated');
      } else {
        const { error: err } = await supabase.from('bank_accounts').insert({ name: accountNameInput, is_cash: false });
        if (err) throw err; success('Success', 'Account created');
      }
      setIsAccountModalOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounts-page', selectedYear?.id] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['sales-page'] }),
        queryClient.invalidateQueries({ queryKey: ['purchases-page'] }),
      ]);
    } catch (err: any) { error('Error', err.message); }
  };

  // ═══ Payment mode save/delete (existing) ═══════════════════════════════
  const handleSaveMode = async () => {
    if (!modeNameInput.trim() || !activeBankId) { error('Validation', 'Name required'); return; }
    try {
      const { error: err } = await supabase.from('payment_modes').insert({ bank_account_id: activeBankId, name: modeNameInput });
      if (err) throw err; success('Success', 'Mode added'); setIsModeModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['accounts-page', selectedYear?.id] });
    } catch (err: any) { error('Error', err.message); }
  };

  const handleDeleteMode = async (modeId: string) => {
    try {
      const { error: err } = await supabase.from('payment_modes').delete().eq('id', modeId);
      if (err) throw err; success('Success', 'Mode removed');
      await queryClient.invalidateQueries({ queryKey: ['accounts-page', selectedYear?.id] });
    } catch (err: any) { error('Error', err.message); }
  };

  // ═══ Add Funds ════════════════════════════════════════════════════════
  const openAddFunds = (preselectedAccountId?: string) => {
    if (!selectedYear) return;
    setAddFundsAccountId(preselectedAccountId || '');
    setAddFundsAmount('');
    setAddFundsDate(clampToFinancialYear(selectedYear));
    setAddFundsNotes('');
    setIsAddFundsOpen(true);
  };

  const handleAddFunds = async () => {
    if (!selectedYear) return;
    if (!addFundsAccountId) { error('Validation', 'Please select an account'); return; }
    const amt = Number(addFundsAmount);
    if (!addFundsAmount || isNaN(amt) || amt <= 0) { error('Validation', 'Amount must be greater than zero'); return; }
    if (!addFundsDate) { error('Validation', 'Date is required'); return; }

    setIsAddFundsSaving(true);
    try {
      const res = await fetch('/api/accounts/add-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_account_id: addFundsAccountId,
          amount: amt,
          date: addFundsDate,
          notes: addFundsNotes,
          financial_year_id: selectedYear.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      success('Success', 'Funds added successfully');
      setIsAddFundsOpen(false);
      await refreshAll();
    } catch (err: any) { error('Error', err.message); } finally { setIsAddFundsSaving(false); }
  };

  // ═══ Transfer Funds ═══════════════════════════════════════════════════
  const openTransfer = (preselectedFromId?: string) => {
    if (!selectedYear) return;
    setTransferFromId(preselectedFromId || '');
    setTransferToId('');
    setTransferAmount('');
    setTransferDate(clampToFinancialYear(selectedYear));
    setTransferNotes('');
    setIsTransferOpen(true);
  };

  const handleTransfer = async () => {
    if (!selectedYear) return;
    if (!transferFromId) { error('Validation', 'Source account is required'); return; }
    if (!transferToId) { error('Validation', 'Destination account is required'); return; }
    if (transferFromId === transferToId) { error('Validation', 'Source and destination must be different'); return; }
    const amt = Number(transferAmount);
    if (!transferAmount || isNaN(amt) || amt <= 0) { error('Validation', 'Amount must be greater than zero'); return; }
    if (!transferDate) { error('Validation', 'Date is required'); return; }

    setIsTransferSaving(true);
    try {
      const res = await fetch('/api/accounts/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_bank_account_id: transferFromId,
          to_bank_account_id: transferToId,
          amount: amt,
          date: transferDate,
          notes: transferNotes,
          financial_year_id: selectedYear.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      success('Success', 'Transfer completed successfully');
      setIsTransferOpen(false);
      await refreshAll();
    } catch (err: any) { error('Error', err.message); } finally { setIsTransferSaving(false); }
  };

  // ═══ Transaction History ══════════════════════════════════════════════
  const openHistory = (accountId: string, accountName: string) => {
    setHistoryAccountId(accountId);
    setHistoryAccountName(accountName);
    setIsHistoryOpen(true);
  };

  // ═══ Computed values for transfer source balance display ═══════════════
  const transferSourceBalance = transferFromId ? (balances[transferFromId] || 0) : null;

  // ═══ Loading skeleton ═════════════════════════════════════════════════
  if (fyLoading || accountsQuery.isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="flex items-center justify-between"><div className="space-y-1.5"><div className="h-4 w-28 bg-slate-100 rounded" /><div className="h-3 w-56 bg-slate-100 rounded" /></div><div className="flex gap-2"><div className="h-8 w-24 bg-slate-100 rounded-md" /><div className="h-8 w-24 bg-slate-100 rounded-md" /><div className="h-8 w-32 bg-slate-100 rounded-md" /></div></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-3"><div className="h-9 w-9 bg-slate-100 rounded-lg" /><div className="space-y-1.5"><div className="h-3.5 w-24 bg-slate-100 rounded" /><div className="h-2.5 w-12 bg-slate-100 rounded" /></div></div>
              <div className="h-7 w-32 bg-slate-100 rounded" />
              <div className="pt-3 border-t border-slate-100 flex gap-2">{[...Array(3)].map((_, j) => <div key={j} className="h-7 w-20 bg-slate-100 rounded-md" />)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">Accounts</h1>
          <p className="text-[11px] text-slate-400 mt-1">Bank accounts, balances, fund management and transactions</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isReadOnly && (
            <>
              <Button size="sm" variant="outline" onClick={() => openAddFunds()} className="gap-1.5 text-xs h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300">
                <ArrowDownToLine className="h-3.5 w-3.5" /> Add Funds
              </Button>
              <Button size="sm" variant="outline" onClick={() => openTransfer()} className="gap-1.5 text-xs h-8 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Transfer
              </Button>
              <Button size="sm" onClick={() => { setEditingAccount(null); setAccountNameInput(''); setIsAccountModalOpen(true); }} className="gap-1.5 text-xs h-8 bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-3.5 w-3.5" /> Add Account
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Account Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map(account => {
          const bal = balances[account.id] || 0;
          const modes = paymentModes.filter(m => m.bank_account_id === account.id);
          return (
            <div key={account.id} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
              {/* Top row: icon + name + edit */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', account.is_cash ? 'bg-emerald-50' : 'bg-indigo-50')}>
                    {account.is_cash ? <Banknote className="h-5 w-5 text-emerald-600" /> : <Landmark className="h-5 w-5 text-indigo-600" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-900">{account.name}</span>
                      {account.is_cash && <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Cash</span>}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-px">This FY balance</p>
                  </div>
                </div>
                {!isReadOnly && !account.is_cash && (
                  <button onClick={() => { setEditingAccount(account); setAccountNameInput(account.name); setIsAccountModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Balance */}
              <div>
                <span className={cn('text-2xl font-semibold tracking-tight tabular-nums', bal < 0 ? 'text-rose-600' : 'text-slate-900')}>
                  {formatINR(bal)} Rs.
                </span>
                {bal < 0 && <span className="text-[10px] text-rose-500 ml-1">deficit</span>}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                {!isReadOnly && (
                  <>
                    <button onClick={() => openAddFunds(account.id)} className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors border border-emerald-200">
                      <ArrowDownToLine className="h-3 w-3" /> Add Funds
                    </button>
                    <button onClick={() => openTransfer(account.id)} className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors border border-indigo-200">
                      <ArrowLeftRight className="h-3 w-3" /> Transfer
                    </button>
                  </>
                )}
                <button onClick={() => openHistory(account.id, account.name)} className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-md transition-colors border border-slate-200">
                  <History className="h-3 w-3" /> History
                </button>
              </div>

              {/* Payment Modes (non-cash only) */}
              {!account.is_cash && (
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Payment Modes</span>
                    {!isReadOnly && <button onClick={() => { setActiveBankId(account.id); setModeNameInput(''); setIsModeModalOpen(true); }} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 transition-colors"><Plus className="h-2.5 w-2.5" /> Add</button>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {modes.map(m => (
                      <div key={m.id} className="inline-flex items-center gap-1 bg-slate-50 text-slate-700 px-2 py-1 rounded-md text-[11px] font-medium border border-slate-200">
                        <Wallet className="h-3 w-3 text-slate-400" />{m.name}
                        {!isReadOnly && <button onClick={() => { setModeToDelete(m); setIsDeleteConfirmOpen(true); }} className="text-slate-400 hover:text-rose-600 ml-0.5 transition-colors"><X className="h-3 w-3" /></button>}
                      </div>
                    ))}
                    {modes.length === 0 && <span className="text-[11px] text-slate-400 italic">No modes added</span>}
                  </div>
                </div>
              )}
              {account.is_cash && (
                <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">Cash — no payment modes needed.</p>
              )}
            </div>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           MODALS
           ═══════════════════════════════════════════════════════════════════ */}

      {/* ── Account Add/Edit Modal (existing) ─────────────────── */}
      <Modal isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} title={editingAccount ? 'Edit Account' : 'Add Bank Account'}
        footer={<><Button variant="outline" onClick={() => setIsAccountModalOpen(false)}>Cancel</Button><Button onClick={handleSaveAccount}>Save</Button></>}>
        <div className="space-y-1"><label className="text-xs font-medium text-slate-600">Account Name</label><Input placeholder="e.g. HDFC Current Account" value={accountNameInput} onChange={e => setAccountNameInput(e.target.value)} autoFocus className="text-xs" /></div>
      </Modal>

      {/* ── Payment Mode Modal (existing) ─────────────────────── */}
      <Modal isOpen={isModeModalOpen} onClose={() => setIsModeModalOpen(false)} title="Add Payment Mode"
        footer={<><Button variant="outline" onClick={() => setIsModeModalOpen(false)}>Cancel</Button><Button onClick={handleSaveMode}>Save</Button></>}>
        <div className="space-y-3">
          <div className="space-y-1"><label className="text-xs font-medium text-slate-600">Mode Name</label><Input placeholder="e.g. UPI, Card, Bank Transfer" value={modeNameInput} onChange={e => setModeNameInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveMode()} autoFocus className="text-xs" /></div>
          <p className="text-xs text-slate-400">Payment modes help track where money comes from within this account.</p>
        </div>
      </Modal>

      {/* ── Delete mode confirm (existing) ────────────────────── */}
      <ConfirmDialog isOpen={isDeleteConfirmOpen} onClose={() => { setIsDeleteConfirmOpen(false); setModeToDelete(null); }} title="Remove Payment Mode"
        onConfirm={async () => { if (modeToDelete) { await handleDeleteMode(modeToDelete.id); setIsDeleteConfirmOpen(false); setModeToDelete(null); } }}
        confirmText="Remove" isDestructive description={`Remove '${modeToDelete?.name}'?`} />

      {/* ── Add Funds Modal ───────────────────────────────────── */}
      <Modal
        isOpen={isAddFundsOpen}
        onClose={() => !isAddFundsSaving && setIsAddFundsOpen(false)}
        title="Add Funds"
        description="Add money to an account for the selected financial year."
        footer={
          <>
            <Button variant="outline" onClick={() => setIsAddFundsOpen(false)} disabled={isAddFundsSaving}>Cancel</Button>
            <Button onClick={handleAddFunds} isLoading={isAddFundsSaving} className="bg-emerald-600 hover:bg-emerald-700">Add Funds</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Account *</label>
            <Select
              value={addFundsAccountId}
              onChange={v => setAddFundsAccountId(v)}
              options={[{ value: '', label: 'Select account' }, ...accounts.map(a => ({ value: a.id, label: `${a.name}${a.is_cash ? ' (Cash)' : ''}` }))]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Amount *</label>
              <Input type="number" placeholder="0.00" value={addFundsAmount} onChange={e => setAddFundsAmount(e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Date *</label>
              <Input type="date" value={addFundsDate} onChange={e => setAddFundsDate(e.target.value)} min={selectedYear?.start_date} max={selectedYear?.end_date} className="text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Notes <span className="text-slate-400">(optional)</span></label>
            <Textarea placeholder="e.g. Opening balance, cash deposit, etc." value={addFundsNotes} onChange={e => setAddFundsNotes(e.target.value)} rows={2} className="text-xs resize-none" />
          </div>
        </div>
      </Modal>

      {/* ── Transfer Funds Modal ──────────────────────────────── */}
      <Modal
        isOpen={isTransferOpen}
        onClose={() => !isTransferSaving && setIsTransferOpen(false)}
        title="Transfer Funds"
        description="Move money between accounts within the selected financial year."
        footer={
          <>
            <Button variant="outline" onClick={() => setIsTransferOpen(false)} disabled={isTransferSaving}>Cancel</Button>
            <Button onClick={handleTransfer} isLoading={isTransferSaving}>Transfer</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">From Account *</label>
              <Select
                value={transferFromId}
                onChange={v => { setTransferFromId(v); if (v === transferToId) setTransferToId(''); }}
                options={[{ value: '', label: 'Select source' }, ...accounts.map(a => ({ value: a.id, label: `${a.name}${a.is_cash ? ' (Cash)' : ''}` }))]}
              />
              {transferSourceBalance !== null && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Balance: <span className={cn('font-semibold font-mono', transferSourceBalance < 0 ? 'text-rose-600' : 'text-emerald-700')}>{formatINR(transferSourceBalance)} Rs.</span>
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">To Account *</label>
              <Select
                value={transferToId}
                onChange={v => setTransferToId(v)}
                options={[{ value: '', label: 'Select destination' }, ...accounts.filter(a => a.id !== transferFromId).map(a => ({ value: a.id, label: `${a.name}${a.is_cash ? ' (Cash)' : ''}` }))]}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Amount *</label>
              <Input type="number" placeholder="0.00" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Date *</label>
              <Input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} min={selectedYear?.start_date} max={selectedYear?.end_date} className="text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Notes <span className="text-slate-400">(optional)</span></label>
            <Textarea placeholder="e.g. Cash deposit to bank" value={transferNotes} onChange={e => setTransferNotes(e.target.value)} rows={2} className="text-xs resize-none" />
          </div>
        </div>
      </Modal>

      {/* ── Transaction History Modal ─────────────────────────── */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => { setIsHistoryOpen(false); setHistoryAccountId(null); }}
        title={`Transactions — ${historyAccountName}`}
        description={selectedYear ? `FY ${selectedYear.start_date} to ${selectedYear.end_date}` : ''}
        className="max-w-2xl"
      >
        <div className="min-h-[200px]">
          {historyQuery.isLoading && (
            <div className="space-y-2 animate-pulse">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-50 rounded-md" />)}
            </div>
          )}

          {historyQuery.isError && (
            <div className="text-center py-8 text-xs text-rose-500">Failed to load transactions.</div>
          )}

          {!historyQuery.isLoading && !historyQuery.isError && (
            <>
              {(historyQuery.data?.length || 0) === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">No transactions found for this account in the selected financial year.</div>
              ) : (
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-left min-w-[520px]">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        {['Date', 'Type', 'Notes', 'Credit', 'Debit'].map((h, i) => (
                          <th key={i} className={cn('px-4 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400', i >= 3 ? 'text-right' : '')}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {historyQuery.data?.map(tx => {
                        const colors = getTransactionColor(tx.reference_type, tx.type);
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-2.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">{tx.date}</td>
                            <td className="px-4 py-2.5">
                              <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold', colors.badge)}>
                                {tx.type === 'credit' ? <ArrowDownLeft className="h-2.5 w-2.5" /> : <ArrowUpRight className="h-2.5 w-2.5" />}
                                {getTransactionLabel(tx.reference_type, tx.type)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[150px] truncate">{tx.notes || '—'}</td>
                            <td className="px-4 py-2.5 text-right text-xs font-mono tabular-nums">
                              {tx.type === 'credit' ? <span className="font-semibold text-emerald-700">{formatINR(Number(tx.amount))}</span> : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs font-mono tabular-nums">
                              {tx.type === 'debit' ? <span className="font-semibold text-rose-600">{formatINR(Number(tx.amount))}</span> : <span className="text-slate-300">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
