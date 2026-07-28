'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/platform/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { Store, Building, CalendarDays, X, CheckCircle2 } from 'lucide-react';

export default function OnboardingPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const router = useRouter();
  const { error, success } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Business Profile
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [gstin, setGstin] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Step 2: First Bank Account & Cash
  const [bankName, setBankName] = useState('');
  const [paymentModeInput, setPaymentModeInput] = useState('');
  const [paymentModes, setPaymentModes] = useState<string[]>(['UPI', 'Card', 'Bank Transfer']);

  // Step 3: Financial Year
  const [fyStart, setFyStart] = useState('');
  const [fyEnd, setFyEnd] = useState('');

  const handleAddMode = () => {
    if (paymentModeInput.trim() && !paymentModes.includes(paymentModeInput.trim())) {
      setPaymentModes([...paymentModes, paymentModeInput.trim()]);
      setPaymentModeInput('');
    }
  };

  const removeMode = (mode: string) => {
    setPaymentModes(paymentModes.filter(m => m !== mode));
  };

  const validateStep1 = () => {
    if (!storeName.trim() || !phone.trim()) {
      error('Validation Error', 'Store Name and Phone are required.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!bankName.trim()) {
      error('Validation Error', 'First Bank Account Name is required.');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!fyStart || !fyEnd) {
      error('Validation Error', 'Start Date and End Date are required.');
      return false;
    }
    if (new Date(fyStart) >= new Date(fyEnd)) {
      error('Validation Error', 'Start Date must be earlier than End Date.');
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (step === 1 && validateStep1()) setStep(2);
    if (step === 2 && validateStep2()) setStep(3);
  };

  const prevStep = () => {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3);
  };

  const handleFinish = async () => {
    if (!validateStep3()) return;

    setIsLoading(true);
    try {
      // Get the current authenticated user — middleware guarantees this succeeds.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        error('Session Error', 'Your session has expired. Please sign in again.');
        router.push('/login');
        return;
      }

      let logoUrl = null;
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const filePath = `${user.id}_logo_${Date.now()}.${ext}`;
        const { data, error: uploadErr } = await supabase.storage
          .from('store_assets')
          .upload(filePath, logoFile);
        if (!uploadErr && data) {
          const { data: publicUrlData } = supabase.storage
            .from('store_assets')
            .getPublicUrl(filePath);
          logoUrl = publicUrlData.publicUrl;
        } else {
          console.error("Logo upload failed or bucket doesn't exist", uploadErr);
          // Non-critical — continue without logo.
        }
      }

      const { data: storeData, error: storeErr } = await supabase
        .from('store')
        .insert({
          owner_user_id: user.id,
          name: storeName,
          address: address || null,
          phone,
          email: email || null,
          website: website || null,
          gstin: gstin || null,
          logo_url: logoUrl,
          onboarding_complete: true,
        })
        .select('id')
        .single();

      if (storeErr) throw new Error('Store creation failed: ' + storeErr.message);

      const { data: bankData, error: bankErr } = await supabase
        .from('bank_accounts')
        .insert([
          { name: 'Cash', is_cash: true },
          { name: bankName, is_cash: false },
        ])
        .select('id, name, is_cash');

      if (bankErr) throw new Error('Bank creation failed: ' + bankErr.message);

      const mainBank = bankData.find((b: any) => b.name === bankName && !b.is_cash);
      if (mainBank && paymentModes.length > 0) {
        const modesToInsert = paymentModes.map(m => ({
          bank_account_id: mainBank.id,
          name: m,
        }));
        await supabase.from('payment_modes').insert(modesToInsert);
      }

      const { data: fyData, error: fyErr } = await supabase
        .from('financial_years')
        .insert({
          start_date: fyStart,
          end_date: fyEnd,
          status: 'active',
          sale_counter: 0,
          purchase_counter: 0,
        })
        .select('id')
        .single();

      if (fyErr) throw new Error('Financial year creation failed: ' + fyErr.message);

      const { error: updErr } = await supabase
        .from('store')
        .update({ active_financial_year_id: fyData.id })
        .eq('id', storeData.id);

      if (updErr) throw new Error('Store update failed: ' + updErr.message);

      success('Setup Complete!', 'Welcome to Fusion One.');
      // Navigate to dashboard. Middleware reads onboarding_complete: true from
      // the DB on the next request and allows access.
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      console.error(err);
      error('Setup Failed', err.message || 'Ensure your database tables are created.');
    } finally {
      setIsLoading(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8 gap-3">
      {[1, 2, 3].map((num) => (
        <React.Fragment key={num}>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
              step === num
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : step > num
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-slate-100 text-slate-400'
            }`}
          >
            {step > num ? <CheckCircle2 className="w-5 h-5" /> : num}
          </div>
          {num < 3 && (
            <div
              className={`w-12 h-1 rounded-full ${step > num ? 'bg-indigo-200' : 'bg-slate-100'}`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-white shadow-xl shadow-slate-200/50 border-slate-200 p-2 sm:p-4">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Business Setup
          </CardTitle>
          <CardDescription>Let's configure Fusion One for your store.</CardDescription>
        </CardHeader>

        <CardContent>
          <StepIndicator />

          <div className="min-h-[300px]">
            {step === 1 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                <div className="flex items-center gap-2 mb-6 text-indigo-600 border-b border-indigo-50 pb-4">
                  <Store className="w-5 h-5" />
                  <h3 className="font-semibold text-lg">Business Profile</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-sm font-medium text-slate-700">Store Name *</label>
                    <Input
                      placeholder="Fusion Store"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-sm font-medium text-slate-700">Address</label>
                    <Input
                      placeholder="123 Main St"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Phone *</label>
                    <Input
                      placeholder="+1 234 567 8900"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Email</label>
                    <Input
                      type="email"
                      placeholder="contact@store.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Website</label>
                    <Input
                      placeholder="www.store.com"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">GSTIN</label>
                    <Input
                      placeholder="Optional Tax ID"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-sm font-medium text-slate-700">Store Logo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                <div className="flex items-center gap-2 mb-6 text-indigo-600 border-b border-indigo-50 pb-4">
                  <Building className="w-5 h-5" />
                  <h3 className="font-semibold text-lg">Bank Setup</h3>
                </div>

                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md border border-slate-200">
                  A <strong>Cash</strong> account will be created automatically with no payment
                  modes. Below, define your primary bank account and its incoming/outgoing payment
                  modes.
                </p>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">
                      First Bank Account Name *
                    </label>
                    <Input
                      placeholder="e.g. HDFC Current Account"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="text-sm font-medium text-slate-700">
                      Supported Payment Modes
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. UPI, Card"
                        value={paymentModeInput}
                        onChange={(e) => setPaymentModeInput(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === 'Enter' && (e.preventDefault(), handleAddMode())
                        }
                      />
                      <Button variant="secondary" onClick={handleAddMode} type="button">
                        Add
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      {paymentModes.map((mode) => (
                        <div
                          key={mode}
                          className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-sm font-medium border border-indigo-100"
                        >
                          {mode}
                          <button
                            onClick={() => removeMode(mode)}
                            className="hover:text-indigo-900 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {paymentModes.length === 0 && (
                        <span className="text-sm text-slate-400 italic">No modes added</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                <div className="flex items-center gap-2 mb-6 text-indigo-600 border-b border-indigo-50 pb-4">
                  <CalendarDays className="w-5 h-5" />
                  <h3 className="font-semibold text-lg">Financial Year</h3>
                </div>

                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md border border-slate-200">
                  Set up your first financial year. All transactions and stock will be recorded
                  under this ledger period. You can create the next year when this one ends.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Start Date *</label>
                    <Input
                      type="date"
                      value={fyStart}
                      onChange={(e) => setFyStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">End Date *</label>
                    <Input
                      type="date"
                      value={fyEnd}
                      onChange={(e) => setFyEnd(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-100">
            <Button variant="ghost" onClick={prevStep} disabled={step === 1 || isLoading}>
              Back
            </Button>

            {step < 3 ? (
              <Button onClick={nextStep} className="min-w-[100px]">
                Next
              </Button>
            ) : (
              <Button onClick={handleFinish} isLoading={isLoading} className="min-w-[120px]">
                Finish Setup
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
