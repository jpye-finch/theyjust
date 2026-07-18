import { supabase } from '../../lib/supabase';

// Signing out only happens after the server confirms the account is gone: if we
// signed out first and deletion failed, the parent would be locked out of an
// account that still exists.
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw new Error(error.message);
  await supabase.auth.signOut();
}
