/**
 * Settings — mutations.
 * Store profile save (with logo/signature upload), extracted from app/settings/page.tsx.
 */
import { supabase } from '@/platform/supabase/client';

export interface StoreFormData {
  name:     string;
  address:  string;
  phone:    string;
  email:    string;
  website:  string;
  gstin:    string;
}

export async function saveStoreProfile(opts: {
  storeId:       string;
  userId:        string;
  formData:      StoreFormData;
  logoFile?:     File | null;
  currentLogoUrl?: string | null;
  signatureFile?: File | null;
  currentSignatureUrl?: string | null;
}): Promise<{ logoUrl: string | null; signatureUrl: string | null }> {
  const { storeId, userId, formData, logoFile, currentLogoUrl, signatureFile, currentSignatureUrl } = opts;

  let logoUrl = currentLogoUrl ?? null;
  if (logoFile) {
    const ext      = logoFile.name.split('.').pop();
    const filePath = `${userId}_logo_${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('store_assets').upload(filePath, logoFile);
    if (uploadErr) throw new Error('Logo upload failed: ' + uploadErr.message);
    logoUrl = supabase.storage.from('store_assets').getPublicUrl(filePath).data.publicUrl;
  }

  let signatureUrl = currentSignatureUrl ?? null;
  if (signatureFile) {
    const ext      = signatureFile.name.split('.').pop();
    const filePath = `${userId}_signature_${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('store_assets').upload(filePath, signatureFile);
    if (uploadErr) throw new Error('Signature upload failed: ' + uploadErr.message);
    signatureUrl = supabase.storage.from('store_assets').getPublicUrl(filePath).data.publicUrl;
  }

  const { error: updateErr } = await supabase
    .from('store')
    .update({ ...formData, logo_url: logoUrl, signature_url: signatureUrl } as any)
    .eq('id', storeId);
  if (updateErr) throw updateErr;

  return { logoUrl, signatureUrl };
}
