import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export type Child = {
  id: string;
  family_id: string;
  name: string;
  date_of_birth: string;
  due_date: string | null;
};

export type ChildInput = {
  name: string;
  dateOfBirth: string;
  dueDate: string | null;
};

// create_family is idempotent (Plan 1): for any existing membership it returns
// that family; for a brand-new user it creates one. Either way: one call.
// The trap: an owner-only lookup would fork an invited co-parent (role
// 'parent', Plan 4) into a phantom family instead of their inviter's — the RPC
// returns the family of ANY existing membership, enforced at the DB level; see
// migration 20260716000003 and its pgTAP case.
export async function ensureFamilyId(): Promise<string> {
  const { data, error } = await supabase.rpc('create_family', { family_name: null });
  if (error) throw error;
  return data as string;
}

export async function fetchChildren(): Promise<Child[]> {
  const { data, error } = await supabase
    .from('children')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Child[];
}

export async function createChild(input: ChildInput): Promise<Child> {
  const family_id = await ensureFamilyId();
  const { data, error } = await supabase
    .from('children')
    .insert({
      family_id,
      name: input.name,
      date_of_birth: input.dateOfBirth,
      due_date: input.dueDate,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Child;
}

export async function updateChild(id: string, input: ChildInput): Promise<Child> {
  const { data, error } = await supabase
    .from('children')
    .update({ name: input.name, date_of_birth: input.dateOfBirth, due_date: input.dueDate })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Child;
}

export function useChildren() {
  return useQuery({ queryKey: ['children'], queryFn: fetchChildren });
}

export function useCreateChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createChild,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['children'] }),
  });
}

export function useUpdateChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ChildInput }) => updateChild(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['children'] }),
  });
}
