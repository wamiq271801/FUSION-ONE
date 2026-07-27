'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

export interface Party {
  id: string;
  name: string;
  number: string;
  address: string | null;
}

interface PartyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (party: Party) => void;
  initialData?: Party | null;
}

export function PartyFormModal({ isOpen, onClose, onSuccess, initialData }: PartyFormModalProps) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { error, success } = useToast();

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isOpen) {
      timeout = setTimeout(() => {
        if (initialData) {
          setName(initialData.name);
          setNumber(initialData.number);
          setAddress(initialData.address || '');
        } else {
          setName('');
          setNumber('');
          setAddress('');
        }
      }, 0);
    }
    return () => clearTimeout(timeout);
  }, [isOpen, initialData]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedNumber = number.trim();
    const trimmedAddress = address.trim();

    if (!trimmedName || !trimmedNumber) {
      error('Validation Error', 'Name and Number are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (initialData) {
        const { data, error: updateErr } = await supabase
          .from('parties')
          .update({ name: trimmedName, number: trimmedNumber, address: trimmedAddress || null })
          .eq('id', initialData.id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        success('Success', 'Party updated successfully.');
        onSuccess(data);
      } else {
        const { data, error: insertErr } = await supabase
          .from('parties')
          .insert({ name: trimmedName, number: trimmedNumber, address: trimmedAddress || null })
          .select()
          .single();

        if (insertErr) throw insertErr;
        success('Success', 'Party added successfully.');
        onSuccess(data);
      }
      onClose();
    } catch (err: any) {
      error('Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Edit Party" : "Add Party"}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSave} isLoading={isSubmitting}>Save Party</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Name *</label>
          <Input 
            placeholder="e.g. Acme Corp" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Phone Number *</label>
          <Input 
            placeholder="e.g. +1 555 1234" 
            value={number} 
            onChange={(e) => setNumber(e.target.value)} 
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Address</label>
          <Input 
            placeholder="e.g. 123 Business Rd" 
            value={address} 
            onChange={(e) => setAddress(e.target.value)} 
          />
        </div>
      </div>
    </Modal>
  );
}
