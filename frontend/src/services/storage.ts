import { supabase } from '../supabase';

const sanitizeFileName = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, '_');

export const buildReceiptPath = (prefix: string, entityId: string, fileName: string) => {
  const safeName = sanitizeFileName(fileName);
  return `${prefix}/${entityId}_${Date.now()}_${safeName}`;
};

export const resolveReceiptUrl = async (storedValue?: string | null) => {
  if (!storedValue) return null;
  if (/^https?:\/\//i.test(storedValue)) return storedValue;

  const { data } = supabase.storage
    .from('receipts')
    .getPublicUrl(storedValue);

  return data?.publicUrl ?? null;
};
