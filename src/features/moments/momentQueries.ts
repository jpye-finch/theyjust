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

export type MomentEdit = {
  milestoneId: string | null;
  customTitle: string | null;
  occurredOn: string;
  note: string;
};

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
  // getSession() reads the local session (no network hop); RLS still enforces
  // logged_by = auth.uid() server-side, so a stale id would be rejected, not trusted.
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
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

// occurred_on + note are the only fields this app-level edit sends. child_id,
// id, created_at, and logged_by are locked out of Plan 1's column-scoped update
// grant; milestone_id/custom_title are grantable there but intentionally
// untouched here (MVP has no "recategorise this moment" flow).
export async function updateMoment(id: string, edit: MomentEdit): Promise<Moment> {
  const { data, error } = await supabase
    .from('moments')
    .update({
      milestone_id: edit.milestoneId,
      custom_title: edit.customTitle,
      occurred_on: edit.occurredOn,
      note: edit.note,
    })
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

// Storage first, deliberately: the row is the only record of the path, so
// dropping it first would strand the blob in the bucket with nothing pointing
// at it. If the object goes but the row fails, the moment shows a broken photo
// the parent can remove again, which is the recoverable direction.
export async function deleteMomentPhoto(photoId: string, storagePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from('moment-photos')
    .remove([storagePath]);
  // Supabase errors are plain objects, not Errors, and the screens test with
  // `e instanceof Error` before showing a message. Wrapping keeps the real
  // reason visible instead of falling back to "Please try again".
  if (storageError) throw new Error(storageError.message);

  const { error } = await supabase.from('moment_photos').delete().eq('id', photoId);
  if (error) throw new Error(error.message);
}

// Every child's moments in one round trip, keyed by child. The notification
// plan needs the whole family at once — one query rather than a useTimeline per
// child, which would mean a variable number of hooks and a request each.
// Still filtered by child_id, per the Plan 1 guardrail: RLS is a per-row
// post-filter, so an unfiltered select would scan every family's moments.
export async function fetchFamilyMoments(childIds: string[]): Promise<Record<string, Moment[]>> {
  if (childIds.length === 0) return {};
  const { data, error } = await supabase
    .from('moments')
    .select('*, moment_photos(*)')
    .in('child_id', childIds)
    .order('occurred_on', { ascending: false });
  if (error) throw error;

  const byChild: Record<string, Moment[]> = {};
  for (const childId of childIds) byChild[childId] = [];
  for (const moment of (data ?? []) as Moment[]) {
    (byChild[moment.child_id] ??= []).push(moment);
  }
  return byChild;
}

export function useFamilyMoments(childIds: string[]) {
  return useQuery({
    // Sorted, so the same family always produces the same key whatever order
    // the children arrived in.
    queryKey: ['family-moments', [...childIds].sort().join(',')],
    queryFn: () => fetchFamilyMoments(childIds),
    enabled: childIds.length > 0,
  });
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
    // Refresh the Timeline feed AND the Milestones "achieved" state — they read
    // different keys (['timeline'] vs ['moments'] via useMomentSummaries) off the
    // same moments table, so a change must invalidate both.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timeline', childId] });
      qc.invalidateQueries({ queryKey: ['moments', childId] });
    },
  });
}

export function useUpdateMoment(childId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, edit }: { id: string; edit: MomentEdit }) => updateMoment(id, edit),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timeline', childId] });
      qc.invalidateQueries({ queryKey: ['moments', childId] });
    },
  });
}

export function useDeleteMoment(childId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteMoment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timeline', childId] });
      qc.invalidateQueries({ queryKey: ['moments', childId] });
    },
  });
}
