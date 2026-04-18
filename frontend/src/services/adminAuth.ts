import { supabase } from '../supabase';

export interface EnsureFarmerAuthUserResult {
  userId: string;
  email: string;
}

export const ensureFarmerAuthUser = async (
  email: string,
  password: string
): Promise<EnsureFarmerAuthUserResult> => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();
  const { data, error } = await supabase.functions.invoke('manage-farmer-auth', {
    body: {
      action: 'ensure_farmer_user',
      email: normalizedEmail,
      password: normalizedPassword,
    },
  });

  if (error) {
    throw error;
  }
  if (!data?.userId || !data?.email) {
    throw new Error('invalid-edge-function-response');
  }
  return { userId: data.userId as string, email: data.email as string };
};
