'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useFinancialYear } from '@/shared/providers/FinancialYearProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { PartyFormModal } from '@/components/parties/PartyFormModal';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useFormData } from '@/shared/hooks/use-form-data';
import { createPurchase } from '@/domains/purchases/mutations';

interface PhoneItem {
  id: string; // temp id for UI list
  brand: string;
  model: string;
  imei: string;
  ram_rom: string;
  color: string;
  purchase_price: string;
  base_selling_price: string;
}

export default function NewPurchasePage() {
  const router = useRouter();
  const { selectedYear, isReadOnly, isLoading: fyLoading } = useFinancialYear();
  const { error, success } = useToast();
  const queryClient = useQueryClient();

  const formDataQuery = useFormData();
  const parties = formDataQuery.data?.parties ?? [];
  const bankAccounts = formDataQuery.data?.bankAccounts ?? [];
  const paymentModes = formDataQuery.data?.paymentModes ?? [];

  const isLoading = fyLoading || formDataQuery.isLoading;

  const [isSaving, setIsSaving] = useState(false);

  const [date, setDate] = useState('');
  const [partyId, setPartyId] = useState('');
  const [items, setItems] = useState<PhoneItem[]>([
    { id: '1', brand: '', model: '', imei: '', ram_rom: '', color: '', purchase_price: '', base_selling_price: '' }
  ]);
  const [bankAccountId, setBankAccountId] = useState('');
  const [paymentModeId, setPaymentModeId] = useState('');
  const [paid, setPaid] = useState('');

  // Party Modal
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);

  useEffect(() => {
    if (fyLoading || !selectedYear) return;
    if (isReadOnly) { error('Access Denied', 'Cannot create purchase in a closed financial year.'); router.push('/purchases'); return; }
    const today = new Date().toISOString().split('T')[0];
    if (today < selectedYear.start_date) setDate(selectedYear.start_date);
    else if (today > selectedYear.end_date) setDate(selectedYear.end_date);
    else setDate(today);
  }, [selectedYear, fyLoading, isReadOnly, error, router]);

  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.purchase_price) || 0), 0);
  }, [items]);

  const due = useMemo(() => {
    return Math.max(0, total - (Number(paid) || 0));
  }, [total, paid]);

  const handleAddItem = () => {
    setItems([...items, { id: Math.random().toString(), brand: '', model: '', imei: '', ram_rom: '', color: '', purchase_price: '', base_selling_price: '' }]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return;
    setItems(items.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof PhoneItem, value: string) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSave = async () => {
    if (!selectedYear) return;

    // Validation
    if (!date || date < selectedYear.start_date || date > selectedYear.end_date) {
      error('Validation', `Date must be within selected financial year (${selectedYear.start_date} to ${selectedYear.end_date})`); return;
    }
    if (!partyId) { error('Validation', 'Party is required'); return; }
    
    // Items Validation
    let uniqueImeis = new Set();
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.brand.trim()) { error('Validation', `Brand is required on row ${i + 1}`); return; }
        if (!item.model.trim()) { error('Validation', `Model is required on row ${i + 1}`); return; }
        const trimmedImei = item.imei.trim();
        if (!/^\d{15}$/.test(trimmedImei)) { error('Validation', `IMEI must be exactly 15 digits on row ${i + 1}`); return; }
        if (uniqueImeis.has(trimmedImei)) { error('Validation', `Duplicate IMEI ${trimmedImei} found in the list`); return; }
        uniqueImeis.add(trimmedImei);
        if (!item.ram_rom.trim()) { error('Validation', `RAM/ROM is required on row ${i + 1}`); return; }
        if (!item.color.trim()) { error('Validation', `Color is required on row ${i + 1}`); return; }
        const pPrice = Number(item.purchase_price);
        if (isNaN(pPrice) || pPrice < 0) { error('Validation', `Valid purchase price required on row ${i + 1}`); return; }
        const sPrice = Number(item.base_selling_price);
        if (isNaN(sPrice) || sPrice < 0) { error('Validation', `Valid base selling price required on row ${i + 1}`); return; }
    }

    const nPaid = Number(paid) || 0;
    if (nPaid < 0) { error('Validation', 'Paid amount cannot be negative'); return; }
    if (nPaid > total) { error('Validation', 'Paid amount cannot exceed total'); return; }

    if (nPaid > 0) {
        if (!bankAccountId) { error('Validation', 'Bank account is required for payment'); return; }
        const bk = bankAccounts.find(b => b.id === bankAccountId);
        if (!bk?.is_cash && !paymentModeId) { error('Validation', 'Payment mode is required for non-cash accounts'); return; }
    }

    setIsSaving(true);
    try {
        const { purchaseId, billNumber } = await createPurchase({
          partyId,
          date,
          items,
          total,
          paid: nPaid,
          due,
          bankAccountId: bankAccountId || bankAccounts[0].id,
          paymentModeId,
          financialYear: selectedYear,
        });

        success('Success', `Purchase ${billNumber} created!`);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['purchases-page', selectedYear.id] }),
          queryClient.invalidateQueries({ queryKey: ['inventory-page', selectedYear.id] }),
          queryClient.invalidateQueries({ queryKey: ['payments-page', selectedYear.id] }),
          queryClient.invalidateQueries({ queryKey: ['accounts-page', selectedYear.id] }),
          queryClient.invalidateQueries({ queryKey: ['parties-page', selectedYear.id] }),
          queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        ]);

        router.push(`/purchases/${purchaseId}`);

    } catch (err: unknown) {
        setIsSaving(false);
        error('Error', err instanceof Error ? err.message : 'Failed to save purchase.');
    }
  };

  const selectedBank = bankAccounts.find(b => b.id === bankAccountId);
  const applicableModes = paymentModes.filter(m => m.bank_account_id === bankAccountId);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 w-8 bg-slate-100 rounded-full" />
        <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="h-4 w-24 bg-slate-100 rounded mb-4" /><div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><div className="h-3 w-10 bg-slate-100 rounded" /><div className="h-10 bg-slate-100 rounded-md" /></div><div className="space-y-1.5"><div className="h-3 w-20 bg-slate-100 rounded" /><div className="h-10 bg-slate-100 rounded-md" /></div></div></div>
        <div className="space-y-4"><div className="h-4 w-28 bg-slate-100 rounded" /><div className="rounded-xl border border-slate-200 bg-white p-4"><div className="grid grid-cols-4 gap-3">{[...Array(8)].map((_,i) => <div key={i} className="space-y-1.5"><div className="h-3 w-14 bg-slate-100 rounded" /><div className="h-9 bg-slate-100 rounded-md" /></div>)}</div></div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="h-4 w-32 bg-slate-100 rounded mb-4" /><div className="flex gap-8"><div className="flex-1 space-y-3"><div className="h-10 w-40 bg-slate-100 rounded-md" /></div><div className="w-64 h-32 bg-slate-50 rounded-lg" /></div></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:shadow-sm transition-all shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">New Purchase</h1>
          <p className="text-[11px] text-slate-400 mt-1">Add phones to inventory via purchase bill.</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Header Setup */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 mb-4">Bill Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Date *</label>
                <Input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  min={selectedYear?.start_date}
                  max={selectedYear?.end_date}
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-slate-700">Supplier (Party) *</label>
                  <button onClick={() => setIsPartyModalOpen(true)} className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold flex items-center gap-1">
                    <Plus className="h-3 w-3" /> New
                  </button>
                </div>
                <Select
                  value={partyId}
                  onChange={v => setPartyId(v)}
                  options={[{ value: '', label: 'Select Supplier' }, ...parties.map(p => ({ value: p.id, label: `${p.name} (${p.number})` }))]}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-800 px-1">Phones Received</h3>
          {items.map((item, index) => (
            <Card key={item.id} className="border-slate-200 shadow-sm relative overflow-visible">
              {items.length > 1 && (
                <button 
                  onClick={() => handleRemoveItem(item.id)}
                  className="absolute -right-2 -top-2 bg-rose-100 text-rose-600 p-1.5 rounded-full hover:bg-rose-600 hover:text-white transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
              <CardContent className="p-4 bg-slate-50/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center">{index + 1}</span>
                  <div className="h-px flex-1 bg-slate-200"></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Brand *</label>
                    <Input placeholder="Apple" value={item.brand} onChange={e => handleItemChange(item.id, 'brand', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Model *</label>
                    <Input placeholder="iPhone 15" value={item.model} onChange={e => handleItemChange(item.id, 'model', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-medium text-slate-700">IMEI (15 Digits) *</label>
                    <Input placeholder="123456789012345" maxLength={15} value={item.imei} onChange={e => handleItemChange(item.id, 'imei', e.target.value)} className="font-mono h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">RAM / ROM *</label>
                    <Input placeholder="8/256" value={item.ram_rom} onChange={e => handleItemChange(item.id, 'ram_rom', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Color *</label>
                    <Input placeholder="Black" value={item.color} onChange={e => handleItemChange(item.id, 'color', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Pur. Price *</label>
                    <Input type="number" placeholder="0" value={item.purchase_price} onChange={e => handleItemChange(item.id, 'purchase_price', e.target.value)} className="h-9 text-sm font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Base SP / MRP *</label>
                    <Input type="number" placeholder="0" value={item.base_selling_price} onChange={e => handleItemChange(item.id, 'base_selling_price', e.target.value)} className="h-9 text-sm font-mono" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          <Button variant="outline" onClick={handleAddItem} className="w-full border-dashed border-2 py-6 text-indigo-600 bg-indigo-50/30 hover:bg-indigo-50">
            <Plus className="h-4 w-4 mr-2" /> Add Another Phone
          </Button>
        </div>

        {/* Summary & Payment */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-5">
            <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 mb-4">Payment & Summary</h3>
            
            <div className="flex flex-col md:flex-row gap-8">
              {/* Payment Details */}
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Paid Now</label>
                    <Input type="number" placeholder="0" value={paid} onChange={e => setPaid(e.target.value)} className="font-mono" />
                  </div>
                </div>

                {Number(paid) > 0 && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-md">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">From Account *</label>
                      <Select
                        value={bankAccountId}
                        onChange={v => {
                          setBankAccountId(v);
                          setPaymentModeId('');
                        }}
                        options={[{ value: '', label: 'Select Account' }, ...bankAccounts.map(b => ({ value: b.id, label: `${b.name}${b.is_cash ? ' (Cash)' : ''}` }))]}
                      />
                    </div>

                    {selectedBank && !selectedBank.is_cash && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Mode *</label>
                        <Select
                          value={paymentModeId}
                          onChange={v => setPaymentModeId(v)}
                          options={[{ value: '', label: 'Select' }, ...applicableModes.map(m => ({ value: m.id, label: m.name }))]}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="w-full md:w-64 bg-slate-50 rounded-lg p-4 border border-slate-100 flex flex-col justify-center space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Items:</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Total:</span>
                  <span className="text-xl font-mono font-semibold text-slate-900 border-b-2 border-indigo-200">
                    {total.toFixed(2)} Rs.
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm text-emerald-700">
                  <span>Paid:</span>
                  <span className="font-mono -mr-[2px]">- {(Number(paid) || 0).toFixed(2)} Rs.</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="font-bold text-slate-800">Due:</span>
                  <span className="text-lg font-mono font-bold text-rose-600">
                    {due.toFixed(2)} Rs.
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => router.push('/purchases')} disabled={isSaving}>Cancel</Button>
              <Button onClick={handleSave} isLoading={isSaving} className="min-w-[140px]">Save Purchase</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <PartyFormModal
        isOpen={isPartyModalOpen}
        onClose={() => setIsPartyModalOpen(false)}
        onSuccess={(party) => {
          queryClient.invalidateQueries({ queryKey: ['form-dropdown-data'] });
          setPartyId(party.id);
        }}
      />
    </div>
  );
}
