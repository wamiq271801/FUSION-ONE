'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useStoreTemplates } from '@/hooks/useStoreTemplates';
import type { TemplateVariant } from '@/lib/invoice/types';
import type { InvoiceType } from '@/hooks/useStoreTemplates';
import {
  Store, LogOut, Upload, Save, User, FileText, Check,
  ChevronRight, Layers, MessageCircle,
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { DELIVERY_SETTINGS_KEY, defaultDeliverySettings, type DeliverySettings } from '@/lib/invoice/delivery';
import { WhatsAppPlatformPanel } from '@/components/settings/WhatsAppPlatformPanel';

// ─── Template Catalogue ─────────────────────────────────────────────────────

const TEMPLATES: { variant: TemplateVariant; label: string; desc: string }[] = [
  { variant: 'prestige', label: 'Prestige',  desc: 'Luxury black & gold — premium electronics' },
  { variant: 'classic',  label: 'Classic',   desc: 'Traditional borders — accountant friendly' },
  { variant: 'minimal',  label: 'Minimal',   desc: 'Typography-first — clean SaaS style' },
  { variant: 'retail',   label: 'Retail',    desc: 'Compact & dense — optimised for many items' },
  { variant: 'executive',label: 'Executive', desc: 'Navy blue corporate — B2B formal' },
  { variant: 'heritage', label: 'Heritage',  desc: 'Serif elegance — premium traditional' },
];

const INVOICE_SECTIONS: { type: InvoiceType; label: string; desc: string }[] = [
  { type: 'sale',     label: 'Sales Invoice',  desc: 'Template used when printing a Tax Invoice' },
  { type: 'purchase', label: 'Purchase Bill',  desc: 'Template used when printing a Purchase Bill' },
  { type: 'proforma', label: 'Quotation',      desc: 'Template used when printing a Quotation / Proforma' },
];

// ─── Invoice Templates Panel ─────────────────────────────────────────────────

function InvoiceTemplatesPanel() {
  const { templates, isSaving, setTemplate, error } = useStoreTemplates();
  const { success, error: showError } = useToast();

  const handleSelect = (type: InvoiceType, variant: TemplateVariant) => {
    setTemplate(type, variant);
    success('Template saved', `${INVOICE_SECTIONS.find(s => s.type === type)?.label} → ${TEMPLATES.find(t => t.variant === variant)?.label}`);
  };

  useEffect(() => {
    if (error) showError('Save failed', (error as Error).message);
  }, [error]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Invoice Templates</h2>
        <p className="text-[11px] text-slate-400 mt-0.5">Choose a design for each invoice type. Saved automatically.</p>
      </div>

      {INVOICE_SECTIONS.map(({ type, label, desc }) => (
        <div key={type} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
            <FileText className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
            <div>
              <span className="text-xs font-semibold text-slate-900">{label}</span>
              <span className="text-[11px] text-slate-400 ml-2">{desc}</span>
            </div>
          </div>

          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TEMPLATES.map(({ variant, label: tLabel, desc: tDesc }) => {
              const isSelected = templates[type] === variant;
              return (
                <button
                  key={variant}
                  onClick={() => handleSelect(type, variant)}
                  disabled={isSaving}
                  className={cn(
                    'relative text-left rounded-lg border-2 px-3 py-2.5 transition-all duration-150 focus:outline-none',
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50',
                    isSaving && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  {isSelected && (
                    <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </span>
                  )}
                  <p className={cn(
                    'text-xs font-semibold leading-none mb-1',
                    isSelected ? 'text-indigo-700' : 'text-slate-800'
                  )}>
                    {tLabel}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight">{tDesc}</p>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Profile Panel ─────────────────────────────────────────────────────────

function WhatsAppDeliveryPanel() {
  const { success } = useToast();
  const [settings, setSettings] = useState<DeliverySettings>(defaultDeliverySettings);
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(DELIVERY_SETTINGS_KEY) || '{}'); setSettings({ sale: { ...defaultDeliverySettings.sale, ...saved.sale }, proforma: { ...defaultDeliverySettings.proforma, ...saved.proforma } }); } catch { setSettings(defaultDeliverySettings); } }, []);
  const save = () => { localStorage.setItem(DELIVERY_SETTINGS_KEY, JSON.stringify(settings)); success('Saved', 'WhatsApp delivery preferences updated'); };
  const fields = [{ type: 'sale' as const, label: 'Sales Invoice' }, { type: 'proforma' as const, label: 'Quotation / Proforma' }];
  return <div className="space-y-5"><WhatsAppPlatformPanel /><div><h2 className="text-sm font-semibold text-slate-900">WhatsApp Delivery</h2><p className="text-[11px] text-slate-400 mt-0.5">Configure customer invoice messages and automatic delivery.</p></div>{fields.map(({ type, label }) => <div key={type} className="rounded-xl border border-slate-200 bg-white overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5"><div><p className="text-xs font-semibold text-slate-900">{label}</p><p className="text-[11px] text-slate-400">Sent only to the customer number for this document.</p></div><label className="flex items-center gap-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={settings[type].autoSend} onChange={event => setSettings(current => ({ ...current, [type]: { ...current[type], autoSend: event.target.checked } }))} className="h-4 w-4 accent-indigo-600" />Auto Send</label></div><div className="p-5 space-y-2"><label className="text-xs font-medium text-slate-700">Message template</label><textarea value={settings[type].template} onChange={event => setSettings(current => ({ ...current, [type]: { ...current[type], template: event.target.value } }))} rows={6} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-xs leading-relaxed outline-none focus:border-indigo-500" /><div className="rounded-lg bg-slate-50 p-3 text-xs whitespace-pre-wrap text-slate-600">{settings[type].template.replace(/{{\s*customer_name\s*}}/g, 'Alex').replace(/{{\s*invoice_number\s*}}/g, 'INV-2026-0001').replace(/{{\s*invoice_date\s*}}/g, '28 Jul 2026').replace(/{{\s*company_name\s*}}/g, 'Fusion Gadgets').replace(/{{\s*grand_total\s*}}/g, '25,000.00 Rs.').replace(/{{\s*payment_status\s*}}/g, 'Paid').replace(/{{\s*(due_date|company_phone|company_address)\s*}}/g, '')}</div><p className="text-[10px] text-slate-400">Variables: {'{{customer_name}}'}, {'{{invoice_number}}'}, {'{{invoice_date}}'}, {'{{company_name}}'}, {'{{grand_total}}'}, {'{{due_date}}'}, {'{{payment_status}}'}, {'{{company_phone}}'}, {'{{company_address}}'}</p></div></div>)}<div className="flex justify-end"><Button size="sm" onClick={save} className="gap-1.5 text-xs h-8 bg-indigo-600 hover:bg-indigo-700"><Save className="h-3.5 w-3.5" />Save Delivery Settings</Button></div></div>;
}

function ProfilePanel() {
  const { signOut, user } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [storeData, setStoreData] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', address: '', phone: '', email: '', website: '', gstin: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [currentSignatureUrl, setCurrentSignatureUrl] = useState<string | null>(null);
  const [signatureObjectUrl, setSignatureObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!logoFile) { setLogoObjectUrl(null); return; }
    const url = URL.createObjectURL(logoFile); setLogoObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  useEffect(() => {
    if (!signatureFile) { setSignatureObjectUrl(null); return; }
    const url = URL.createObjectURL(signatureFile); setSignatureObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [signatureFile]);

  const storeQuery = useQuery({
    queryKey: ['settings-store', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error: err } = await supabase.from('store').select('*').eq('owner_user_id', user.id).single();
      if (err) throw err;
      return data;
    },
  });

  useEffect(() => {
    const data = storeQuery.data;
    if (!data) return;
    setStoreData(data);
    setFormData({ name: data.name || '', address: data.address || '', phone: data.phone || '', email: data.email || '', website: data.website || '', gstin: data.gstin || '' });
    setCurrentLogoUrl(data.logo_url || null);
    setCurrentSignatureUrl(data.signature_url || null);
  }, [storeQuery.data]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    if (!user || !storeData) return;
    setIsSaving(true);
    try {
      let logoUrl = currentLogoUrl;
      if (logoFile) {
        const filePath = `${user.id}_logo_${Date.now()}.${logoFile.name.split('.').pop()}`;
        const { error: uploadErr } = await supabase.storage.from('store_assets').upload(filePath, logoFile);
        if (uploadErr) throw new Error('Logo upload failed: ' + uploadErr.message);
        logoUrl = supabase.storage.from('store_assets').getPublicUrl(filePath).data.publicUrl;
      }

      let signatureUrl = currentSignatureUrl;
      if (signatureFile) {
        const filePath = `${user.id}_signature_${Date.now()}.${signatureFile.name.split('.').pop()}`;
        const { error: uploadErr } = await supabase.storage.from('store_assets').upload(filePath, signatureFile);
        if (uploadErr) throw new Error('Signature upload failed: ' + uploadErr.message);
        signatureUrl = supabase.storage.from('store_assets').getPublicUrl(filePath).data.publicUrl;
      }

      const nextStoreData = { ...storeData, ...formData, logo_url: logoUrl, signature_url: signatureUrl };
      const { error: updateErr } = await supabase.from('store').update({ ...formData, logo_url: logoUrl, signature_url: signatureUrl } as any).eq('id', storeData.id);
      if (updateErr) throw updateErr;
      queryClient.setQueryData(['settings-store', user.id], nextStoreData);
      setStoreData(nextStoreData);
      setCurrentLogoUrl(logoUrl); setLogoFile(null);
      setCurrentSignatureUrl(signatureUrl); setSignatureFile(null);
      success('Saved', 'Business profile updated');
    } catch (err: any) { error('Error', err.message); } finally { setIsSaving(false); }
  };

  if (storeQuery.isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="space-y-1.5"><div className="h-4 w-20 bg-slate-100 rounded" /><div className="h-3 w-56 bg-slate-100 rounded" /></div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
          <div className="flex gap-5"><div className="w-24 h-24 bg-slate-100 rounded-xl" /><div className="flex-1 space-y-3"><div className="h-3 w-16 bg-slate-100 rounded" /><div className="h-9 bg-slate-100 rounded-lg" /></div></div>
          <div className="h-16 bg-slate-100 rounded-lg" />
          <div className="grid grid-cols-2 gap-3"><div className="h-9 bg-slate-100 rounded-lg" /><div className="h-9 bg-slate-100 rounded-lg" /></div>
        </div>
      </div>
    );
  }

  const logoPreviewUrl = logoObjectUrl ?? currentLogoUrl;
  const signaturePreviewUrl = signatureObjectUrl ?? currentSignatureUrl;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Business Profile</h2>
        <p className="text-[11px] text-slate-400 mt-0.5">Used on all bills and PDFs</p>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
          <Store className="h-3.5 w-3.5 text-indigo-600" />
          <span className="text-xs font-semibold text-slate-900">Store Details</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="flex gap-4 shrink-0">
              {/* Logo */}
              <div className="space-y-2">
                <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors">
                  {logoPreviewUrl
                    ? <Image src={logoPreviewUrl} alt="Logo" fill style={{ objectFit: 'contain' }} className="p-2" referrerPolicy="no-referrer" />
                    : <div className="flex flex-col items-center text-slate-400"><Upload className="h-5 w-5 mb-1" /><span className="text-[9px] uppercase font-bold tracking-wider">Logo</span></div>}
                  <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                {logoFile && <button onClick={() => setLogoFile(null)} className="text-[11px] text-rose-500 font-medium w-full text-center hover:underline">Clear</button>}
              </div>
              {/* Signature */}
              <div className="space-y-2">
                <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors">
                  {signaturePreviewUrl
                    ? <Image src={signaturePreviewUrl} alt="Signature" fill style={{ objectFit: 'contain' }} className="p-2" referrerPolicy="no-referrer" />
                    : <div className="flex flex-col items-center text-slate-400"><Upload className="h-5 w-5 mb-1" /><span className="text-[9px] uppercase font-bold tracking-wider">Signature</span></div>}
                  <input type="file" accept="image/*" onChange={e => setSignatureFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                {signatureFile && <button onClick={() => setSignatureFile(null)} className="text-[11px] text-rose-500 font-medium w-full text-center hover:underline">Clear</button>}
              </div>
            </div>
            <div className="flex-1 w-full space-y-3">
              <div className="space-y-1">
                <label htmlFor="name" className="text-xs font-medium text-slate-600">Store Name<span className="text-rose-500 ml-0.5">*</span></label>
                <Input id="name" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Mobile World" className="text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="phone" className="text-xs font-medium text-slate-600">Phone<span className="text-rose-500 ml-0.5">*</span></label>
                  <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} placeholder="+91…" className="text-xs" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="email" className="text-xs font-medium text-slate-600">Email</label>
                  <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="hello@example.com" className="text-xs" />
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="address" className="text-xs font-medium text-slate-600">Address</label>
            <textarea id="address" name="address" rows={2} value={formData.address} onChange={handleChange} placeholder="Street, city, state, zip…"
              className="w-full border border-slate-200 rounded-lg bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="gstin" className="text-xs font-medium text-slate-600">GSTIN</label>
              <Input id="gstin" name="gstin" value={formData.gstin} onChange={handleChange} placeholder="Optional" className="text-xs uppercase" />
            </div>
            <div className="space-y-1">
              <label htmlFor="website" className="text-xs font-medium text-slate-600">Website</label>
              <Input id="website" name="website" value={formData.website} onChange={handleChange} placeholder="www.example.com" className="text-xs" />
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <Button size="sm" onClick={handleSave} isLoading={isSaving} disabled={!formData.name || !formData.phone} className="gap-1.5 text-xs h-8 bg-indigo-600 hover:bg-indigo-700">
            <Save className="h-3.5 w-3.5" /> Save Changes
          </Button>
        </div>
      </div>

      {/* Account card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-900">Account</span>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-[11px] text-slate-400 mb-1">Signed in as</p>
            <p className="text-xs font-semibold text-slate-900 truncate">{user?.email}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => signOut()} className="w-full gap-1.5 text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200">
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar nav items ────────────────────────────────────────────────────────

type ActiveTab = 'profile' | 'templates' | 'whatsapp';

const SIDEBAR_ITEMS: { id: ActiveTab; label: string; icon: any }[] = [
  { id: 'profile',   label: 'Profile',           icon: User   },
  { id: 'templates', label: 'Invoice Templates', icon: Layers },
  { id: 'whatsapp', label: 'WhatsApp Delivery', icon: MessageCircle },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1);
      if (hash === 'profile' || hash === 'templates' || hash === 'whatsapp') return hash;
    }
    return 'profile';
  });

  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">Settings</h1>
        <p className="text-[11px] text-slate-400 mt-1">Business profile and invoice preferences</p>
      </div>

      <div className="flex gap-5 items-start">
        {/* ── Compact Sidebar ── */}
        <nav className="w-36 shrink-0 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <ul className="py-1.5 px-1.5 space-y-0.5">
            {SIDEBAR_ITEMS.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <li key={id}>
                  <button
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left',
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-indigo-600' : 'text-slate-400')} />
                    <span className="truncate">{label}</span>
                    {isActive && <ChevronRight className="h-3 w-3 ml-auto text-indigo-400 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0">
          {activeTab === 'profile'   && <ProfilePanel />}
          {activeTab === 'templates' && <InvoiceTemplatesPanel />}
          {activeTab === 'whatsapp' && <WhatsAppDeliveryPanel />}
        </div>
      </div>
    </div>
  );
}
