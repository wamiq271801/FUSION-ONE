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
import { Modal } from '@/components/ui/Modal';
import { PartyFormModal } from '@/components/parties/PartyFormModal';
import { Plus, Trash2, ArrowLeft, Search, RefreshCw, Pencil } from 'lucide-react';
import { useFormData, useInStockItems } from '@/hooks/use-form-data';

interface SelectedSaleItem {
  id: string;
  brand: string;
  model: string;
  imei: string;
  ram_rom: string;
  color: string;
  sold_price: string;
  base_selling_price: string;
}

interface TradeInItem {
  id: string;
  brand: string;
  model: string;
  imei: string;
  ram_rom: string;
  color: string;
  credit_value: string;
  mrp: string;
  file?: File | null;
}

export default function NewSalePage() {
  const router = useRouter();
  const { selectedYear, isReadOnly, isLoading: fyLoading } = useFinancialYear();
  const { error, success } = useToast();
  const queryClient = useQueryClient();

  const [isSaving, setIsSaving] = useState(false);

  // Form Data
  const [date, setDate] = useState('');
  const [partyId, setPartyId] = useState('');
  const [discount, setDiscount] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedSaleItem[]>([]);
  const [tradeIns, setTradeIns] = useState<TradeInItem[]>([]);
  
  const [bankAccountId, setBankAccountId] = useState('');
  const [paymentModeId, setPaymentModeId] = useState('');
  const [paid, setPaid] = useState('');

  // Dropdown Data — from TanStack Query cache (instant if previously loaded)
  const formDataQuery = useFormData();
  const inStockQuery = useInStockItems(selectedYear?.id);
  const parties = formDataQuery.data?.parties ?? [];
  const bankAccounts = formDataQuery.data?.bankAccounts ?? [];
  const paymentModes = formDataQuery.data?.paymentModes ?? [];
  const inStockItems = inStockQuery.data ?? [];

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [isTradeInModalOpen, setIsTradeInModalOpen] = useState(false);
  
  const [tradeInForm, setTradeInForm] = useState<TradeInItem>({
    id: '', brand: '', model: '', imei: '', ram_rom: '', color: '', credit_value: '', mrp: '', file: null
  });

  // Set default date and bank account
  useEffect(() => {
    if (fyLoading || !selectedYear) return;
    if (isReadOnly) { error('Access Denied', 'Cannot create sale in a closed financial year.'); router.push('/dashboard'); return; }
    const today = new Date().toISOString().split('T')[0];
    if (today < selectedYear.start_date) setDate(selectedYear.start_date);
    else if (today > selectedYear.end_date) setDate(selectedYear.end_date);
    else setDate(today);
  }, [selectedYear, fyLoading, isReadOnly, error, router]);

  useEffect(() => {
    if (bankAccounts.length > 0 && !bankAccountId) setBankAccountId(bankAccounts[0].id);
  }, [bankAccounts, bankAccountId]);

  // Handle Prefill (Proforma Conversion)
  useEffect(() => {
    const pData = sessionStorage.getItem('convert_proforma');
    if (pData) {
      try {
        const parsed = JSON.parse(pData);
        if (parsed.party_id) setPartyId(parsed.party_id);
        if (parsed.discount) setDiscount(parsed.discount.toString());
        if (parsed.trade_ins) setTradeIns(parsed.trade_ins);
      } catch (e) {}
    }
  }, []);

  const isLoading = fyLoading || formDataQuery.isLoading || inStockQuery.isLoading;

  const fetchInStockItems = () => {
    queryClient.invalidateQueries({ queryKey: ['in-stock-items', selectedYear?.id] });
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return inStockItems.filter(item => 
      !selectedItems.find(si => si.id === item.id) &&
      (item.imei.toLowerCase().includes(q) || 
       item.brand.toLowerCase().includes(q) || 
       item.model.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [searchQuery, inStockItems, selectedItems]);

  // Totals Calculation
  const subtotal = useMemo(() => {
    return selectedItems.reduce((acc, item) => acc + (Number(item.sold_price) || 0), 0);
  }, [selectedItems]);

  const totalTradeInCredit = useMemo(() => {
    return tradeIns.reduce((acc, ti) => acc + (Number(ti.credit_value) || 0), 0);
  }, [tradeIns]);

  const totalMrpGap = useMemo(() => {
    return tradeIns.reduce((acc, ti) => {
      const g = (Number(ti.mrp) || 0) - (Number(ti.credit_value) || 0);
      return acc + (g > 0 ? g : 0);
    }, 0);
  }, [tradeIns]);

  const finalTotal = useMemo(() => {
    return Math.max(0, subtotal - (Number(discount) || 0) - totalTradeInCredit);
  }, [subtotal, discount, totalTradeInCredit]);

  const due = useMemo(() => {
    return Math.max(0, finalTotal - (Number(paid) || 0));
  }, [finalTotal, paid]);

  // Handlers
  const handleRemoveItem = (id: string) => {
    setSelectedItems(selectedItems.filter(i => i.id !== id));
  };

  const handleUpdateItemPrice = (id: string, price: string) => {
    setSelectedItems(selectedItems.map(i => i.id === id ? { ...i, sold_price: price } : i));
  };

  const handleTradeInSave = () => {
    const { brand, model, imei, ram_rom, color, credit_value } = tradeInForm;
    if (!brand.trim() || !model.trim() || !imei.trim() || !ram_rom.trim() || !color.trim()) {
      error('Validation', 'All mandatory fields required for trade-in.'); return;
    }
    const tImei = imei.trim();
    if (!/^\d{15}$/.test(tImei)) {
      error('Validation', 'IMEI must be exactly 15 digits.'); return;
    }
    
    // Only check duplicates if it's a new item or if the IMEI changed
    const duplicate = tradeIns.find(t => t.imei === tImei && t.id !== tradeInForm.id);
    if (duplicate) {
      error('Validation', 'Trade-in with this IMEI is already added.'); return;
    }
    const cv = Number(credit_value);
    if (isNaN(cv) || cv < 0) {
      error('Validation', 'Valid credit value is required.'); return;
    }

    if (tradeInForm.id) {
      // Edit Mode
      setTradeIns(tradeIns.map(t => t.id === tradeInForm.id ? { ...tradeInForm, imei: tImei, credit_value: cv.toString() } : t));
    } else {
      // Add Mode
      setTradeIns([...tradeIns, { ...tradeInForm, id: Math.random().toString(), imei: tImei, credit_value: cv.toString() }]);
    }
    setIsTradeInModalOpen(false);
  };

  const handleRemoveTradeIn = (id: string) => {
    setTradeIns(tradeIns.filter(t => t.id !== id));
  };

  const handleSaveSale = async () => {
    if (!selectedYear) return;

    if (!partyId) { error('Validation', 'Please select a customer.'); return; }
    if (selectedItems.length === 0) { error('Validation', 'Please add at least one item to sell.'); return; }
    
    if (!date || date < selectedYear.start_date || date > selectedYear.end_date) {
      error('Validation', `Date must be within selected financial year (${selectedYear.start_date} to ${selectedYear.end_date})`); return;
    }

    if (Number(discount) < 0) { error('Validation', 'Discount cannot be negative.'); return; }
    if (finalTotal < 0) { error('Validation', 'Final total cannot be negative. Check discount or trade-in credit.'); return; }
    
    const nPaid = Number(paid) || 0;
    if (nPaid < 0) { error('Validation', 'Paid amount cannot be negative.'); return; }
    if (nPaid > finalTotal) { error('Validation', 'Paid amount cannot exceed final total.'); return; }

    if (nPaid > 0 || bankAccountId) {
      if (!bankAccountId) { error('Validation', 'Bank account is required.'); return; }
      const bk = bankAccounts.find(b => b.id === bankAccountId);
      if (!bk?.is_cash && !paymentModeId && nPaid > 0) { 
        error('Validation', 'Payment mode is required for non-cash accounts.'); return; 
      }
    }

    setIsSaving(true);
    try {
      // 1. Verify all selected items are still in stock
      const itemIds = selectedItems.map(i => i.id);
      const { data: checkStock, error: chkErr } = await supabase
        .from('inventory_items')
        .select('id')
        .in('id', itemIds)
        .eq('status', 'in_stock');
      
      if (chkErr) throw chkErr;
      if (checkStock.length !== selectedItems.length) {
        error('Validation', 'One or more selected items are no longer available in stock.');
        setIsSaving(false); return;
      }

      // 2. Verify Trade-in IMEIs are not globally in stock
      const tiImeis = tradeIns.map(t => t.imei);
      if (tiImeis.length > 0) {
        const { data: tiDups } = await supabase
          .from('inventory_items')
          .select('imei')
          .in('imei', tiImeis)
          .eq('status', 'in_stock');
        if (tiDups && tiDups.length > 0) {
          error('Validation', `Trade-In IMEI ${tiDups[0].imei} already in stock in the system.`);
          setIsSaving(false); return;
        }
      }

      // 3. Counters
      const { data: fyData, error: fyErr } = await supabase
        .from('financial_years')
        .select('sale_counter, purchase_counter, start_date, end_date')
        .eq('id', selectedYear.id)
        .single();
      if (fyErr) throw fyErr;

      const currentSaleCounter = fyData.sale_counter;
      const currentPurchaseCounter = fyData.purchase_counter;
      
      const sYearStr = new Date(fyData.start_date).getFullYear();
      const eYearStr = new Date(fyData.end_date).getFullYear().toString().slice(-2);
      const saleBillNo = `SAL-${sYearStr}-${eYearStr}-${(currentSaleCounter + 1).toString().padStart(4, '0')}`;

      // 4. Update Counters
      await supabase.from('financial_years').update({
        sale_counter: currentSaleCounter + 1,
        purchase_counter: currentPurchaseCounter + tradeIns.length
      }).eq('id', selectedYear.id);

      // 5. Create Sale Record
      const { data: saleData, error: saleErr } = await supabase.from('sales').insert({
        bill_number: saleBillNo,
        party_id: partyId,
        total: subtotal,
        discount: Number(discount) || 0,
        trade_in_credit: totalTradeInCredit,
        final_total: finalTotal,
        paid: nPaid,
        due: due,
        bank_account_id: bankAccountId,
        payment_mode_id: paymentModeId || null,
        date: date,
        financial_year_id: selectedYear.id,
        status: 'active'
      }).select('id').single();
      if (saleErr) throw saleErr;

      // 6. Sale Items
      const saleItemsInsert = selectedItems.map(item => ({
        sale_id: saleData.id,
        inventory_item_id: item.id,
        sold_price: Number(item.sold_price)
      }));
      await supabase.from('sale_items').insert(saleItemsInsert);

      // 7. Update Inventory to Sold
      await supabase.from('inventory_items').update({ status: 'sold' }).in('id', itemIds);

      // 8. Process Trade-Ins
      for (let i = 0; i < tradeIns.length; i++) {
        const ti = tradeIns[i];
        
        // Purchase
        const pNum = currentPurchaseCounter + 1 + i;
        const pBillNo = `PUR-TRD-${sYearStr}-${eYearStr}-${pNum.toString().padStart(4, '0')}`;
        
        const { data: purData, error: purErr } = await supabase.from('purchases').insert({
          bill_number: pBillNo,
          party_id: partyId, 
          total: Number(ti.credit_value),
          paid: Number(ti.credit_value), 
          due: 0,
          bank_account_id: bankAccountId || bankAccounts[0].id, 
          date: date,
          financial_year_id: selectedYear.id,
          status: 'active'
        }).select().single();
        if (purErr) throw purErr;

        // Inventory
        const { data: invData, error: invErr } = await supabase.from('inventory_items').insert({
          brand: ti.brand,
          model: ti.model,
          imei: ti.imei,
          ram_rom: ti.ram_rom,
          color: ti.color,
          purchase_price: Number(ti.credit_value),
          base_selling_price: Number(ti.credit_value), 
          status: 'in_stock',
          source: 'trade_in',
          financial_year_id: selectedYear.id,
          opening_entry_type: 'direct'
        }).select().single();
        if (invErr) throw invErr;

        // Purchase Items
        await supabase.from('purchase_items').insert({
          purchase_id: purData.id,
          inventory_item_id: invData.id
        });

        // Trade-ins Map
        let documentUrl = null;
        if (ti.file) {
          try {
            const ext = ti.file.name.split('.').pop();
            const fileName = `trade_in_${Date.now()}.${ext}`;
            const { data: uploadData } = await supabase.storage.from('documents').upload(`trade_ins/${fileName}`, ti.file);
            if (uploadData) {
              const { data: urlData } = supabase.storage.from('documents').getPublicUrl(`trade_ins/${fileName}`);
              documentUrl = urlData.publicUrl;
            }
          } catch (e) {
            console.warn("Storage error", e);
          }
        }

        await supabase.from('trade_ins').insert({
          sale_id: saleData.id,
          brand: ti.brand,
          model: ti.model,
          imei: ti.imei,
          ram_rom: ti.ram_rom,
          color: ti.color,
          credit_value: Number(ti.credit_value),
          mrp: Number(ti.mrp) || null,
          document_url: documentUrl,
          new_inventory_item_id: invData.id
        });
      }

      // 9. Account Transaction (Sale Payment)
      if (nPaid > 0) {
        await supabase.from('account_transactions').insert({
          bank_account_id: bankAccountId,
          payment_mode_id: paymentModeId || null,
          type: 'credit',
          amount: nPaid,
          date: date,
          reference_type: 'sale',
          reference_id: saleData.id,
          financial_year_id: selectedYear.id
        });

        // Also create payments_in record for payment history
        const { error: piErr } = await supabase
          .from('payments_in')
          .insert({
            sale_id: saleData.id,
            party_id: partyId,
            amount: nPaid,
            bank_account_id: bankAccountId,
            payment_mode_id: paymentModeId || null,
            date: date,
            financial_year_id: selectedYear.id
          });
        if (piErr) throw piErr;
      }

      success('Success', `Sale ${saleBillNo} recorded!`);

      const pDataStr = sessionStorage.getItem('convert_proforma');
      if (pDataStr) {
        try {
          const parsed = JSON.parse(pDataStr);
          if (parsed.proforma_id) {
            await supabase.from('proforma_invoices').update({ status: 'converted' }).eq('id', parsed.proforma_id);
          }
        } catch(e) {}
        sessionStorage.removeItem('convert_proforma');
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales-page', selectedYear.id] }),
        queryClient.invalidateQueries({ queryKey: ['proformas-page', selectedYear.id] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-page', selectedYear.id] }),
        queryClient.invalidateQueries({ queryKey: ['payments-page', selectedYear.id] }),
        queryClient.invalidateQueries({ queryKey: ['accounts-page', selectedYear.id] }),
        queryClient.invalidateQueries({ queryKey: ['parties-page', selectedYear.id] }),
        queryClient.invalidateQueries({ queryKey: ['exchange-page', selectedYear.id] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);

      router.push(`/sales/${saleData.id}`);

    } catch (err: any) {
      setIsSaving(false);
      error('Error', err.message || 'Failed to save sale.');
    }
  };

  const selectedBank = bankAccounts.find(b => b.id === bankAccountId);
  const applicableModes = paymentModes.filter(m => m.bank_account_id === bankAccountId);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 w-8 bg-slate-100 rounded-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><div className="h-3 w-10 bg-slate-100 rounded" /><div className="h-10 bg-slate-100 rounded-md" /></div><div className="space-y-1.5"><div className="h-3 w-20 bg-slate-100 rounded" /><div className="h-10 bg-slate-100 rounded-md" /></div></div></div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"><div className="h-4 w-36 bg-slate-100 rounded" /><div className="h-11 w-full bg-slate-100 rounded-md" /><div className="space-y-3">{[...Array(2)].map((_,i) => <div key={i} className="h-16 w-full bg-slate-50 border border-slate-100 rounded-lg" />)}</div></div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"><div className="h-4 w-32 bg-slate-100 rounded" /><div className="h-14 w-full bg-slate-50 rounded-lg" /></div>
          </div>
          <div className="lg:col-span-1"><div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"><div className="h-4 w-28 bg-slate-100 rounded" /><div className="space-y-3">{[...Array(5)].map((_,i) => <div key={i} className="h-4 w-full bg-slate-100 rounded" />)}</div><div className="h-12 w-full bg-slate-100 rounded-md mt-4" /></div></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:shadow-sm transition-all shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">New Sale</h1>
          <p className="text-[11px] text-slate-400 mt-1">Record a sale, trade-ins, and generate invoice.</p>
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
                    <label className="font-medium text-slate-700">Customer (Party) *</label>
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

          {/* Sale Items */}
          <Card className="border-slate-200 shadow-sm overflow-visible relative z-10 text-sm">
            <CardContent className="p-5">
              <div className="flex justify-between items-end mb-4">
                <h3 className="font-semibold text-slate-800">Select Phones to Sell</h3>
                <Button variant="ghost" size="sm" onClick={fetchInStockItems} title="Refresh Stock" className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search available stock by IMEI, brand or model..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-11"
                />
                
                {searchQuery && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-md overflow-hidden max-h-60 overflow-y-auto">
                    {searchResults.map(item => (
                      <div 
                        key={item.id} 
                        className="p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors"
                        onClick={() => {
                          if (!selectedItems.find(i => i.id === item.id)) {
                            setSelectedItems([...selectedItems, { ...item, sold_price: item.base_selling_price.toString() }]);
                          }
                          setSearchQuery('');
                        }}
                      >
                        <div>
                          <p className="font-medium text-slate-900">{item.brand} {item.model}</p>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">{item.imei} • {item.ram_rom} • {item.color}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-semibold text-indigo-700">{Number(item.base_selling_price).toFixed(2)} Rs.</p>
                          <span className="text-[10px] uppercase font-bold text-slate-400">Base Price</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {searchQuery && searchResults.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-md p-4 text-center text-slate-500">
                    No matching in-stock items found.
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {selectedItems.map((item, idx) => (
                  <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg group">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{item.brand} {item.model}</p>
                      <p className="text-xs text-slate-500 font-mono tracking-wide">{item.imei} • {item.ram_rom} • {item.color}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="space-y-0.5 relative">
                        <label className="text-[10px] font-bold uppercase text-slate-400 absolute -top-4 left-0">Sold Price</label>
                        <Input 
                          type="number" 
                          value={item.sold_price} 
                          onChange={e => handleUpdateItemPrice(item.id, e.target.value)}
                          className="w-28 text-right font-mono"
                        />
                      </div>
                      <button onClick={() => handleRemoveItem(item.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {selectedItems.length === 0 && (
                  <div className="text-center py-6 text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                    No items selected yet. Search above to add phones to this sale.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Trade In */}
          <Card className="border-slate-200 shadow-sm text-sm">
            <CardContent className="p-5">
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-emerald-600" />
                  Trade-Ins (Exchange)
                </h3>
                <Button onClick={() => {
                  setTradeInForm({ id: '', brand: '', model: '', imei: '', ram_rom: '', color: '', credit_value: '', mrp: '', file: null });
                  setIsTradeInModalOpen(true);
                }} variant="outline" size="sm" className="h-8">
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>

              <div className="space-y-3">
                {tradeIns.map((ti) => (
                  <div key={ti.id} className="flex justify-between items-center p-3 border border-emerald-100 bg-emerald-50/50 rounded-lg">
                    <div>
                      <p className="font-medium text-emerald-900">{ti.brand || 'Exchange'} {ti.model}</p>
                      <p className="text-xs text-emerald-700/80 font-mono tracking-wide mt-0.5">
                        {ti.imei ? ti.imei : <span className="text-rose-500 font-semibold">Missing IMEI / Details (Edit)</span>}
                        {ti.ram_rom ? ` • ${ti.ram_rom}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="text-sm font-mono font-semibold text-emerald-700">-{Number(ti.credit_value).toFixed(2)} Rs.</p>
                        <p className="text-[10px] uppercase font-bold text-emerald-600/70">Credit Value</p>
                      </div>
                      <button onClick={() => {
                        setTradeInForm(ti);
                        setIsTradeInModalOpen(true);
                      }} className="text-emerald-700/50 hover:text-emerald-600 p-1">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleRemoveTradeIn(ti.id)} className="text-emerald-700/50 hover:text-rose-600 p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {tradeIns.length === 0 && (
                  <div className="text-sm text-slate-400 italic">No trade-ins associated.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Totals & Payment Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-slate-200 shadow-sm sticky top-6">
            <CardContent className="p-5">
              <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 mb-4">Payment & Totals</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium text-slate-900">{subtotal.toFixed(2)} Rs.</span>
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 font-medium">Additional Discount</span>
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
                
                {totalMrpGap > 0 && (
                  <div className="flex justify-between items-center text-xs text-indigo-600">
                    <span>★ Exchange Bonus Value</span>
                    <span className="font-mono font-medium">{totalMrpGap.toFixed(2)} Rs.</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-3 border-t border-slate-200 mt-2">
                  <span className="font-bold text-slate-900 text-base">Final Total</span>
                  <span className="text-xl font-mono font-bold text-indigo-700">{finalTotal.toFixed(2)} Rs.</span>
                </div>
              </div>

              <div className="bg-slate-50 -mx-5 px-5 py-4 border-t border-b border-slate-100 space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Paid Now</label>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={paid} 
                    onChange={e => setPaid(e.target.value)} 
                    className="text-right font-mono text-emerald-700 font-semibold border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Deposit Account *</label>
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
                    <label className="text-sm font-medium text-slate-700">Payment Mode *</label>
                    <Select
                      value={paymentModeId}
                      onChange={v => setPaymentModeId(v)}
                      options={[{ value: '', label: 'Select' }, ...applicableModes.map(m => ({ value: m.id, label: m.name }))]}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center mt-6">
                <span className="font-bold text-slate-700">Balance Due</span>
                <span className={`text-lg font-mono font-bold ${due > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                  {due.toFixed(2)} Rs.
                </span>
              </div>

              <div className="mt-6 pt-4">
                <Button onClick={handleSaveSale} isLoading={isSaving} className="w-full h-12 text-base font-semibold shadow-sm">
                  Complete Sale
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Part Modal */}
      <PartyFormModal
        isOpen={isPartyModalOpen}
        onClose={() => setIsPartyModalOpen(false)}
        onSuccess={(party) => {
          queryClient.invalidateQueries({ queryKey: ['form-dropdown-data'] });
          setPartyId(party.id);
        }}
      />

      {/* Trade In Modal */}
      <Modal
        isOpen={isTradeInModalOpen}
        onClose={() => setIsTradeInModalOpen(false)}
        title="Add Trade-In Device"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsTradeInModalOpen(false)}>Cancel</Button>
            <Button onClick={handleTradeInSave}>Add Trade-In</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Brand *</label>
            <Input value={tradeInForm.brand} onChange={e => setTradeInForm({...tradeInForm, brand: e.target.value})} placeholder="e.g. Samsung" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Model *</label>
            <Input value={tradeInForm.model} onChange={e => setTradeInForm({...tradeInForm, model: e.target.value})} placeholder="e.g. Galaxy S21" />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <label className="text-sm font-medium text-slate-700">IMEI (15 digits) *</label>
            <Input value={tradeInForm.imei} onChange={e => setTradeInForm({...tradeInForm, imei: e.target.value})} placeholder="15 digit IMEI" className="font-mono" maxLength={15} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">RAM / ROM *</label>
            <Input value={tradeInForm.ram_rom} onChange={e => setTradeInForm({...tradeInForm, ram_rom: e.target.value})} placeholder="e.g. 8/128" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Color *</label>
            <Input value={tradeInForm.color} onChange={e => setTradeInForm({...tradeInForm, color: e.target.value})} placeholder="e.g. Phantom Gray" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Credit Value () *</label>
            <Input type="number" value={tradeInForm.credit_value} onChange={e => setTradeInForm({...tradeInForm, credit_value: e.target.value})} placeholder="0.00" className="font-mono" />
            <p className="text-[10px] text-slate-500 leading-tight mt-1">Amount reduced from bill</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Original MRP () Optional</label>
            <Input type="number" value={tradeInForm.mrp} onChange={e => setTradeInForm({...tradeInForm, mrp: e.target.value})} placeholder="0.00" className="font-mono" />
            <p className="text-[10px] text-slate-500 leading-tight mt-1">For showing exchange bonus to customer</p>
          </div>
          <div className="sm:col-span-2 space-y-1 pt-2">
            <label className="text-sm font-medium text-slate-700">Identity / Declaration Doc (Optional)</label>
            <div className="border-2 border-dashed border-slate-200 rounded p-4 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
              <input 
                type="file" 
                accept="image/*,.pdf" 
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    setTradeInForm({...tradeInForm, file: e.target.files[0]});
                  }
                }} 
                className="text-sm text-slate-600 block w-full mx-auto max-w-[250px]"
              />
            </div>
          </div>
        </div>
      </Modal>

    </div>
  );
}
