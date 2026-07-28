'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/platform/supabase/client';
import { useFinancialYear } from '@/shared/providers/FinancialYearProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Smartphone, Pencil } from 'lucide-react';
import { cn } from '@/shared/utils/utils';
import {
  InventoryItem,
  useInventoryPageData,
  useInventoryInvalidation,
  validateInventoryForm,
} from '@/domains/inventory';

const emptyForm = { brand: '', model: '', imei: '', ram_rom: '', color: '', purchase_price: '', base_selling_price: '' };

export default function InventoryPage() {
  const { selectedYear, isReadOnly, isLoading: fyLoading } = useFinancialYear();
  const { error, success } = useToast();
  const queryClient = useQueryClient();
  const invalidateInventory = useInventoryInvalidation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'sold'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  // Edit state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFormData, setEditFormData] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const inventoryQuery = useInventoryPageData(selectedYear, fyLoading);
  const items = inventoryQuery.data || [];

  const validateForm = (data: typeof emptyForm, _existingItemId?: string) => validateInventoryForm(data);

  const handleSaveItem = async () => {
    const err = validateForm(formData); if (err) { error('Validation', err); return; }
    if (!selectedYear || isReadOnly) return;
    try {
      const { data: dup } = await supabase.from('inventory_items').select('id').eq('imei', formData.imei.trim()).eq('status', 'in_stock').limit(1).maybeSingle();
      if (dup) { error('Validation', 'This IMEI is already in stock.'); return; }
      const { error: insertErr } = await supabase.from('inventory_items').insert({ brand: formData.brand.trim(), model: formData.model.trim(), imei: formData.imei.trim(), ram_rom: formData.ram_rom.trim(), color: formData.color.trim(), purchase_price: Number(formData.purchase_price), base_selling_price: Number(formData.base_selling_price), status: 'in_stock', source: 'purchase', financial_year_id: selectedYear.id, opening_entry_type: 'direct' });
      if (insertErr) throw insertErr;
      success('Success', 'Item added.'); setIsAddModalOpen(false);
      setFormData(emptyForm);
      await invalidateInventory(selectedYear.id);
    } catch (err: any) { error('Error', err.message); }
  };

  const handleEditItem = async () => {
    if (!selectedItem || !selectedYear || isReadOnly) return;
    const err = validateForm(editFormData, selectedItem.id);
    if (err) { error('Validation', err); return; }

    setIsSaving(true);
    try {
      // IMEI duplicate check — only if IMEI changed
      if (editFormData.imei.trim() !== selectedItem.imei) {
        const { data: dup } = await supabase
          .from('inventory_items')
          .select('id')
          .eq('imei', editFormData.imei.trim())
          .eq('status', 'in_stock')
          .neq('id', selectedItem.id)
          .limit(1)
          .maybeSingle();
        if (dup) { error('Validation', 'This IMEI is already in stock.'); setIsSaving(false); return; }
      }

      const { error: updateErr } = await supabase
        .from('inventory_items')
        .update({
          brand: editFormData.brand.trim(),
          model: editFormData.model.trim(),
          imei: editFormData.imei.trim(),
          ram_rom: editFormData.ram_rom.trim(),
          color: editFormData.color.trim(),
          purchase_price: Number(editFormData.purchase_price),
          base_selling_price: Number(editFormData.base_selling_price),
        })
        .eq('id', selectedItem.id);

      if (updateErr) throw updateErr;

      success('Success', 'Item updated.');
      setIsEditMode(false);
      setIsViewModalOpen(false);
      setSelectedItem(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory-page', selectedYear.id] }),
        queryClient.invalidateQueries({ queryKey: ['in-stock-items', selectedYear.id] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    } catch (err: any) {
      error('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const enterEditMode = (item?: InventoryItem) => {
    const target = item || selectedItem;
    if (!target) return;
    setEditFormData({
      brand: target.brand,
      model: target.model,
      imei: target.imei,
      ram_rom: target.ram_rom,
      color: target.color,
      purchase_price: String(target.purchase_price),
      base_selling_price: String(target.base_selling_price),
    });
    setIsEditMode(true);
  };

  const exitEditMode = () => {
    setIsEditMode(false);
  };

  const closeViewModal = () => {
    setIsViewModalOpen(false);
    setIsEditMode(false);
    setSelectedItem(null);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.imei.toLowerCase().includes(searchQuery.toLowerCase()) || item.brand.toLowerCase().includes(searchQuery.toLowerCase()) || item.model.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch && (statusFilter === 'all' || item.status === statusFilter);
  });

  if (fyLoading || inventoryQuery.isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="flex items-center justify-between"><div className="space-y-1.5"><div className="h-4 w-20 bg-slate-100 rounded" /><div className="h-3 w-52 bg-slate-100 rounded" /></div><div className="h-8 w-20 bg-slate-100 rounded-md" /></div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex gap-3"><div className="h-8 w-56 bg-slate-100 rounded-md" /><div className="h-8 w-28 bg-slate-100 rounded-md" /></div>
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex gap-6">{[...Array(6)].map((_, i) => <div key={i} className="h-2.5 w-16 bg-slate-100 rounded" />)}</div>
          {[...Array(7)].map((_, i) => <div key={i} className="flex items-center gap-6 px-4 py-3 border-b border-slate-50">{[...Array(6)].map((_, j) => <div key={j} className="h-3 bg-slate-100 rounded" style={{ width: `${[30,20,15,15,12,8][j]}%` }} />)}</div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">Inventory</h1>
          <p className="text-[11px] text-slate-400 mt-1">Stock for the selected financial year</p>
        </div>
        {!isReadOnly && (
          <Button size="sm" onClick={() => { setFormData(emptyForm); setIsAddModalOpen(true); }} className="gap-1.5 text-xs h-8 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-3.5 w-3.5" /> Add Item
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input placeholder="IMEI, brand or model…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <Select
            value={statusFilter}
            onChange={v => setStatusFilter(v as any)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'in_stock', label: 'In Stock' },
              { value: 'sold', label: 'Sold' },
            ]}
            className="w-28"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['Device & IMEI','Specs','Purchase Price','Selling Price','Status',''].map((h, i) => (
                <th key={i} className={cn('px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400', i >= 2 && i <= 3 ? 'text-right' : i === 4 || i === 5 ? 'text-center' : '')}>{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="text-xs font-medium text-slate-900">{item.brand} {item.model}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">{item.imei}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-xs text-slate-700">{item.ram_rom}</div>
                    <div className="text-[11px] text-slate-400">{item.color}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs font-semibold text-slate-900 tabular-nums">{Number(item.purchase_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Rs.</td>
                  <td className="px-4 py-2.5 text-right text-xs font-semibold text-slate-900 tabular-nums">{Number(item.base_selling_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Rs.</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider', item.status === 'in_stock' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                      {item.status === 'in_stock' ? 'In Stock' : 'Sold'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setSelectedItem(item); setIsEditMode(false); setIsViewModalOpen(true); }} className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">View</button>
                      {!isReadOnly && (
                        <button
                          onClick={() => { setSelectedItem(item); enterEditMode(item); setIsViewModalOpen(true); }}
                          className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          title="Edit item"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">No items found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Inventory Item"
        footer={<><Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button><Button onClick={handleSaveItem}>Save Item</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          {([['brand','Brand *','e.g. Apple'],['model','Model *','e.g. iPhone 15'],['ram_rom','RAM / ROM *','8GB / 256GB'],['color','Color *','Black']] as const).map(([field, label, ph]) => (
            <div key={field} className="space-y-1"><label className="text-xs font-medium text-slate-600">{label}</label><Input placeholder={ph} value={(formData as any)[field]} onChange={e => setFormData(p => ({ ...p, [field]: e.target.value }))} className="text-xs" /></div>
          ))}
          <div className="space-y-1 col-span-2"><label className="text-xs font-medium text-slate-600">IMEI *</label><Input placeholder="15-digit IMEI" value={formData.imei} onChange={e => setFormData(p => ({ ...p, imei: e.target.value }))} className="font-mono text-xs" maxLength={15} /></div>
          <div className="space-y-1"><label className="text-xs font-medium text-slate-600">Purchase Price *</label><Input type="number" placeholder="0.00" value={formData.purchase_price} onChange={e => setFormData(p => ({ ...p, purchase_price: e.target.value }))} className="font-mono text-xs" /></div>
          <div className="space-y-1"><label className="text-xs font-medium text-slate-600">Selling Price / MRP *</label><Input type="number" placeholder="0.00" value={formData.base_selling_price} onChange={e => setFormData(p => ({ ...p, base_selling_price: e.target.value }))} className="font-mono text-xs" /></div>
        </div>
      </Modal>

      {/* View / Edit Item Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={closeViewModal}
        title={isEditMode ? 'Edit Inventory Item' : 'Item Details'}
        footer={
          isEditMode ? (
            <>
              <Button variant="outline" onClick={exitEditMode} disabled={isSaving}>Cancel</Button>
              <Button onClick={handleEditItem} isLoading={isSaving}>Save Changes</Button>
            </>
          ) : (
            <div className="flex items-center gap-2 w-full justify-between">
              <div>
                {!isReadOnly && (
                  <Button variant="outline" onClick={() => enterEditMode()} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                )}
              </div>
              <Button variant="outline" onClick={closeViewModal}>Close</Button>
            </div>
          )
        }
      >
        {selectedItem && !isEditMode && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="p-2 bg-white border border-slate-200 rounded-lg"><Smartphone className="h-5 w-5 text-slate-500" /></div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{selectedItem.brand} {selectedItem.model}</p>
                <p className="text-xs text-slate-400 font-mono">{selectedItem.imei}</p>
              </div>
              <span className={cn('ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded', selectedItem.status === 'in_stock' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                {selectedItem.status === 'in_stock' ? 'In Stock' : 'Sold'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Specs</p><p className="text-xs font-medium text-slate-900">{selectedItem.ram_rom} · {selectedItem.color}</p></div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Source</p><p className="text-xs font-medium text-slate-900 capitalize">{selectedItem.source.replace('_', ' ')}</p></div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Purchase Price</p><p className="text-sm font-semibold text-slate-900 tabular-nums">{Number(selectedItem.purchase_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Rs.</p></div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Selling Price</p><p className="text-sm font-semibold text-slate-900 tabular-nums">{Number(selectedItem.base_selling_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Rs.</p></div>
            </div>
          </div>
        )}

        {selectedItem && isEditMode && (
          <div className="space-y-4">
            {selectedItem.status === 'sold' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700 font-medium">This item has been sold. You can still correct details like brand, model, specs, and color. Price changes won't affect the linked sale record.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {([['brand','Brand *','e.g. Apple'],['model','Model *','e.g. iPhone 15'],['ram_rom','RAM / ROM *','8GB / 256GB'],['color','Color *','Black']] as const).map(([field, label, ph]) => (
                <div key={field} className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">{label}</label>
                  <Input placeholder={ph} value={(editFormData as any)[field]} onChange={e => setEditFormData(p => ({ ...p, [field]: e.target.value }))} className="text-xs" />
                </div>
              ))}
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-medium text-slate-600">IMEI *</label>
                <Input placeholder="15-digit IMEI" value={editFormData.imei} onChange={e => setEditFormData(p => ({ ...p, imei: e.target.value }))} className="font-mono text-xs" maxLength={15} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Purchase Price *</label>
                <Input type="number" placeholder="0.00" value={editFormData.purchase_price} onChange={e => setEditFormData(p => ({ ...p, purchase_price: e.target.value }))} className="font-mono text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Selling Price / MRP *</label>
                <Input type="number" placeholder="0.00" value={editFormData.base_selling_price} onChange={e => setEditFormData(p => ({ ...p, base_selling_price: e.target.value }))} className="font-mono text-xs" />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
