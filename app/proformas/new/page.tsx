'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFinancialYear } from '@/components/providers/FinancialYearProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { PartyFormModal } from '@/components/parties/PartyFormModal';
import { Modal } from '@/components/ui/Modal';
import { Plus, Trash2, ArrowLeft, RefreshCw } from 'lucide-react';
import { useFormData } from '@/hooks/use-form-data';


interface ProformaItem {
  id: string;
  description: string;
  qty: string;
  rate: string;
  discount: string;
}

interface TradeInItem {
  id: string;
  description: string;
  qty: string;
  rate: string;
}

export default function NewProformaPage() {
  const router = useRouter();
  const { selectedYear, isReadOnly, isLoading: fyLoading } = useFinancialYear();
  const { error, success } = useToast();
  const queryClient = useQueryClient();

  const [isSaving, setIsSaving] = useState(false);

  // Form Data
  const [date, setDate] = useState('');
  const [partyId, setPartyId] = useState('');
  const [discount, setDiscount] = useState('');
  const [items, setItems] = useState<ProformaItem[]>([
    { id: Math.random().toString(), description: '', qty: '1', rate: '', discount: '' }
  ]);
  const [tradeIns, setTradeIns] = useState<TradeInItem[]>([]);

  // Dropdown Data
  const formDataQuery = useFormData();
  const parties = formDataQuery.data?.parties ?? [];

  // Modals
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);

  // Set default date
  useEffect(() => {
    if (fyLoading || !selectedYear) return;
    if (isReadOnly) { 
      error('Access Denied', 'Cannot create proforma in a closed financial year.'); 
      router.push('/dashboard'); 
      return; 
    }
    const today = new Date().toISOString().split('T')[0];
    if (today < selectedYear.start_date) setDate(selectedYear.start_date);
    else if (today > selectedYear.end_date) setDate(selectedYear.end_date);
    else setDate(today);
  }, [selectedYear, fyLoading, isReadOnly, error, router]);

  const isLoading = fyLoading || formDataQuery.isLoading;

  // Totals Calculation
  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => {
      const q = Number(item.qty) || 0;
      const r = Number(item.rate) || 0;
      const d = Number(item.discount) || 0;
      return acc + (q * Math.max(0, r - d));
    }, 0);
  }, [items]);

  const totalTradeInCredit = useMemo(() => {
    return tradeIns.reduce((acc, ti) => {
      const q = ti.qty.trim() === '' ? 1 : (Number(ti.qty) || 0);
      const r = Number(ti.rate) || 0;
      return acc + (q * r);
    }, 0);
  }, [tradeIns]);

  const finalTotal = useMemo(() => {
    return Math.max(0, subtotal - (Number(discount) || 0) - totalTradeInCredit);
  }, [subtotal, discount, totalTradeInCredit]);

  // Handlers
  const handleAddItem = () => {
    setItems([...items, { id: Math.random().toString(), description: '', qty: '1', rate: '', discount: '' }]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const handleAddTradeIn = () => {
    setTradeIns([...tradeIns, { id: Math.random().toString(), description: '', qty: '1', rate: '' }]);
  };

  const handleRemoveTradeIn = (id: string) => {
    setTradeIns(tradeIns.filter(t => t.id !== id));
  };

  const handleUpdateTradeIn = (id: string, field: keyof TradeInItem, value: string) => {
    setTradeIns(tradeIns.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleUpdateItem = (id: string, field: keyof ProformaItem, value: string) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleSaveProforma = async () => {
    if (!selectedYear) return;
    if (!partyId) { error('Validation', 'Please select a customer.'); return; }
    
    const validItems = items.filter(i => i.description.trim() !== '');
    if (validItems.length === 0) { error('Validation', 'Please add at least one item with a description.'); return; }
    
    if (!date || date < selectedYear.start_date || date > selectedYear.end_date) {
      error('Validation', `Date must be within selected financial year (${selectedYear.start_date} to ${selectedYear.end_date})`); return;
    }

    if (Number(discount) < 0) { error('Validation', 'Discount cannot be negative.'); return; }
    if (finalTotal < 0) { error('Validation', 'Final total cannot be negative.'); return; }
    
    setIsSaving(true);
    try {
      // Counters
      const { data: fyData, error: fyErr } = await supabase
        .from('financial_years')
        .select('proforma_counter, start_date, end_date')
        .eq('id', selectedYear.id)
        .single();
      if (fyErr) throw fyErr;

      const currentCounter = (fyData as any).proforma_counter || 0;
      
      const sYearStr = new Date(fyData.start_date).getFullYear();
      const eYearStr = new Date(fyData.end_date).getFullYear().toString().slice(-2);
      const pBillNo = `PI-${sYearStr}-${eYearStr}-${(currentCounter + 1).toString().padStart(4, '0')}`;

      // Update Counters
      await supabase.from('financial_years').update({
        proforma_counter: currentCounter + 1
      } as any).eq('id', selectedYear.id);

      // Create Proforma Record
      const { data: pData, error: pErr } = await supabase.from('proforma_invoices').insert({
        bill_number: pBillNo,
        party_id: partyId,
        total: subtotal,
        discount: Number(discount) || 0,
        trade_in_credit: totalTradeInCredit,
        final_total: finalTotal,
        date: date,
        financial_year_id: selectedYear.id,
        status: 'active'
      }).select('id').single();
      if (pErr) throw pErr;

      // Proforma Items
      const pItemsInsert = validItems.map(item => {
        const q = Number(item.qty) || 0;
        const r = Number(item.rate) || 0;
        const d = Number(item.discount) || 0;
        return {
          proforma_invoice_id: pData.id,
          description: item.description,
          qty: q,
          rate: r,
          discount: d,
          value: q * Math.max(0, r - d)
        };
      });
      await supabase.from('proforma_invoice_items').insert(pItemsInsert);

      // Proforma Trade-Ins
      if (tradeIns.length > 0) {
        const validTradeIns = tradeIns.filter(ti => ti.description.trim() !== '');
        if (validTradeIns.length > 0) {
          const pTradeInsInsert = validTradeIns.map(ti => {
            const q = ti.qty.trim() === '' ? null : (Number(ti.qty) || null);
            const r = Number(ti.rate) || 0;
            return {
              proforma_invoice_id: pData.id,
              description: ti.description,
              qty: q,
              rate: r,
              value: (q === null ? 1 : q) * r
            };
          });
          const { error: tiErr } = await supabase.from('proforma_trade_ins').insert(pTradeInsInsert);
          if (tiErr) throw tiErr;
        }
      }

      success('Success', `Quotation ${pBillNo} created!`);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['proformas-page', selectedYear.id] })
      ]);

      router.push(`/proformas/${pData.id}`);

    } catch (err: any) {
      setIsSaving(false);
      error('Error', err.message || 'Failed to create quotation.');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 w-8 bg-slate-100 rounded-full" />
        <div className="h-64 bg-slate-100 rounded-xl" />
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
          <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">New Quotation</h1>
          <p className="text-[11px] text-slate-400 mt-1">Create a quotation or estimate.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative items-start">
        <div className="lg:col-span-2 space-y-6">
          
          {/* Top Info */}
          <Card className="border-slate-200 shadow-sm overflow-visible text-sm relative z-20">
            <CardContent className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-medium text-slate-700">Date *</label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} min={selectedYear?.start_date} max={selectedYear?.end_date} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="font-medium text-slate-700">Customer *</label>
                    <button onClick={() => setIsPartyModalOpen(true)} className="text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 text-xs">
                      <Plus className="h-3 w-3" /> New
                    </button>
                  </div>
                  <Select
                    value={partyId}
                    onChange={v => setPartyId(v)}
                    options={[{ value: '', label: 'Select Customer' }, ...parties.map(p => ({ value: p.id, label: `${p.name} (${p.number})` }))]}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card className="border-slate-200 shadow-sm relative z-10 text-sm">
            <CardContent className="p-5">
              <div className="flex justify-between items-end mb-4 border-b border-slate-100 pb-2">
                <h3 className="font-semibold text-slate-800">Line Items</h3>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={item.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg group space-y-2 text-xs">
                    <Input 
                      placeholder="Item Description (e.g. iPhone 15 Pro Max 256GB)" 
                      value={item.description}
                      onChange={e => handleUpdateItem(item.id, 'description', e.target.value)}
                      className="h-8 py-1 px-2.5 text-xs bg-white animate-none"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-md px-2 h-8">
                        <span className="text-[10px] text-slate-400 font-bold uppercase select-none">Qty:</span>
                        <input 
                          type="number" 
                          value={item.qty}
                          onChange={e => handleUpdateItem(item.id, 'qty', e.target.value)}
                          className="w-10 text-center font-medium text-slate-800 focus:outline-none bg-transparent"
                        />
                      </div>
                      <div className="flex-1 min-w-[90px] flex items-center gap-1.5 bg-white border border-slate-300 rounded-md px-2 h-8">
                        <span className="text-[10px] text-slate-400 font-bold uppercase select-none">Rate:</span>
                        <input 
                          type="number" 
                          value={item.rate}
                          placeholder="MRP"
                          onChange={e => handleUpdateItem(item.id, 'rate', e.target.value)}
                          className="w-full text-right font-medium text-slate-800 focus:outline-none bg-transparent"
                        />
                      </div>
                      <div className="flex-1 min-w-[90px] flex items-center gap-1.5 bg-white border border-slate-300 rounded-md px-2 h-8">
                        <span className="text-[10px] text-slate-400 font-bold uppercase select-none">Disc:</span>
                        <input 
                          type="number" 
                          value={item.discount}
                          placeholder="0.00"
                          onChange={e => {
                            const val = Number(e.target.value) || 0;
                            if (val < 0) return;
                            handleUpdateItem(item.id, 'discount', e.target.value);
                          }}
                          className="w-full text-right font-medium text-slate-800 focus:outline-none bg-transparent"
                        />
                      </div>
                      <div className="bg-slate-100 border border-slate-200 rounded-md px-2 h-8 flex items-center justify-between gap-1.5 min-w-[95px]">
                        <span className="text-[9px] text-slate-500 font-bold uppercase select-none">Amt:</span>
                        <span className="font-mono font-bold text-slate-700">
                          {((Number(item.qty)||0) * Math.max(0, (Number(item.rate)||0) - (Number(item.discount)||0))).toFixed(2)}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleRemoveItem(item.id)} 
                        className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-100 rounded-md transition-colors shrink-0" 
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <Button variant="outline" onClick={handleAddItem} className="mt-4 w-full border-dashed">
                <Plus className="h-4 w-4 mr-2" /> Add Item
              </Button>
            </CardContent>
          </Card>

          {/* Trade In */}
          <Card className="border-slate-200 shadow-sm text-sm">
            <CardContent className="p-5">
              <div className="flex justify-between items-end mb-4 border-b border-slate-100 pb-2">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-emerald-600" />
                  Trade-In Items
                </h3>
              </div>

              <div className="space-y-3">
                {tradeIns.map((ti) => (
                  <div key={ti.id} className="p-2.5 bg-emerald-50/20 border border-emerald-100 rounded-lg group space-y-2 text-xs">
                    <Input 
                      placeholder="Trade-In Item Description (e.g. iPhone 13 - IMEI 123456789012345)" 
                      value={ti.description}
                      onChange={e => handleUpdateTradeIn(ti.id, 'description', e.target.value)}
                      className="h-8 py-1 px-2.5 text-xs bg-white border-emerald-100 focus:border-emerald-500 focus:ring-emerald-500"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-white border border-emerald-200 rounded-md px-2 h-8">
                        <span className="text-[10px] text-emerald-600/70 font-bold uppercase select-none">Qty:</span>
                        <input 
                          type="number" 
                          value={ti.qty}
                          onChange={e => handleUpdateTradeIn(ti.id, 'qty', e.target.value)}
                          className="w-10 text-center font-medium text-emerald-800 focus:outline-none bg-transparent"
                        />
                      </div>
                      <div className="flex-1 min-w-[100px] flex items-center gap-1.5 bg-white border border-emerald-200 rounded-md px-2 h-8">
                        <span className="text-[10px] text-emerald-600/70 font-bold uppercase select-none">Rate:</span>
                        <input 
                          type="number" 
                          value={ti.rate}
                          onChange={e => handleUpdateTradeIn(ti.id, 'rate', e.target.value)}
                          className="w-full text-right font-medium text-emerald-800 focus:outline-none bg-transparent"
                        />
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-md px-2 h-8 flex items-center justify-between gap-1.5 min-w-[100px]">
                        <span className="text-[9px] text-emerald-700 font-bold uppercase select-none">Amt:</span>
                        <span className="font-mono font-bold text-emerald-800">
                          {((ti.qty.trim() === '' ? 1 : (Number(ti.qty)||0)) * (Number(ti.rate)||0)).toFixed(2)}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleRemoveTradeIn(ti.id)} 
                        className="h-8 w-8 flex items-center justify-center text-emerald-600/70 hover:text-rose-600 hover:bg-rose-50 border border-emerald-200 hover:border-rose-100 rounded-md transition-colors shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {tradeIns.length === 0 && (
                  <div className="text-center py-6 text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                    No trade-ins associated. Click below to add trade-in items.
                  </div>
                )}
              </div>
              
              <Button variant="outline" onClick={handleAddTradeIn} className="mt-4 w-full border-dashed border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/30 text-emerald-700">
                <Plus className="h-4 w-4 mr-2" /> Add Trade-In Item
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Totals Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-slate-200 shadow-sm sticky top-6">
            <CardContent className="p-5">
              <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 mb-4">Totals</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium text-slate-900">{subtotal.toFixed(2)} Rs.</span>
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 font-medium">Discount</span>
                  </div>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={discount} 
                    onChange={e => setDiscount(e.target.value)} 
                    className="text-right font-mono"
                  />
                </div>

                <div className="flex justify-between items-center text-sm text-emerald-700 border-t border-slate-100 pt-3">
                  <span>Trade-In</span>
                  <span className="font-mono font-medium">- {totalTradeInCredit.toFixed(2)} Rs.</span>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-200 mt-2">
                  <span className="font-bold text-slate-900 text-base">Grand Total</span>
                  <span className="text-xl font-mono font-bold text-indigo-700">{finalTotal.toFixed(2)} Rs.</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <Button onClick={handleSaveProforma} isLoading={isSaving} className="w-full h-12 text-base font-semibold shadow-sm">
                  Save Quotation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
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
