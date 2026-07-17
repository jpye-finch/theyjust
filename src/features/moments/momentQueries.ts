import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export type MomentPhoto = {
  id: string;
  moment_id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  position: number;
};

export type Moment = {
  id: string;
  child_id: string;
  milestone_id: string | null;
  custom_title: string | null;
  occurred_on: string;
  note: string | null;
  logged_by: string | null;
  created_at: string;
  moment_photos: MomentPhoto[];
};

export type NewMoment = {
  childId: string;
  milestoneId: string | null;
  customTitle: string | null;
  occurredOn: string;
  note: string;
};

export type MomentEdit = { occurredOn: string; note: string };

// ALWAYS filter by child_id: RLS is a per-row post-filter, so an unfiltered
// select would scan every family's moments (Plan 1 guardrail).
export async function fetchTimeline(childId: string): Promise<Moment[]> {
  const { data, error } = await supabase
    .from('moments')
    .select('*, moment_photos(*)')
    .eq('child_id', childId)
    .order('occurred_on', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Moment[];
}

export async function createMoment(input: NewMoment): Promise<Moment> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('moments')
    .insert({
      child_id: input.childId,
      milestone_id: input.milestoneId,
      custom_title: input.customTitle,
      occurred_on: input.occurredOn,
      note: input.note,
      logged_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Moment;
}

// occurred_on + note are the only fields a moment edit touches; milestone_id,
// child_id, and logged_by are locked at the grant layer (Plan 1).
export async function updateMoment(id: string, edit: MomentEdit): Promise<Moment> {
  const { data, error } = await supabase
    .from('moments')
    .update({ occurred_on: edit.occurredOn, note: edit.note })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Moment;
}

export async function deleteMoment(id: string): Promise<void> {
  const { error } = await supabase.from('moments').delete().eq('id', id);
  if (error) throw error;
}

export function useTimeline(childId: string | null) {
  return useQuery({
    queryKey: ['timeline', childId],
    queryFn: () => fetchTimeline(childId as string),
    enabled: childId !== null,
  });
}

export function useCreateMoment(childId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMoment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeline', childId] }),
  });
}

export function useUpdateMoment(childId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, edit }: { id: string; edit: MomentEdit }) => updateMoment(id, edit),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeline', childId] }),
  });
}

export function useDeleteMoment(childId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteMoment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeline', childId] }),
  });
}
