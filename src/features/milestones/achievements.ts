import { useQuery } from '@tanstack/react-query';
import { ageParts, formatAgeParts } from '../children/age';
import { supabase } from '../../lib/supabase';

export type MomentSummary = { milestone_id: string | null; occurred_on: string };

// ALWAYS filter moments by child_id: RLS is a per-row post-filter, and an
// unfiltered select would scan every family's rows (Plan 1 guardrail).
export async function fetchMomentSummaries(childId: string): Promise<MomentSummary[]> {
  const { data, error } = await supabase
    .from('moments')
    .select('milestone_id, occurred_on')
    .eq('child_id', childId);
  if (error) throw error;
  return (data ?? []) as MomentSummary[];
}

export function useMomentSummaries(childId: string | null) {
  return useQuery({
    queryKey: ['moments', childId],
    queryFn: () => fetchMomentSummaries(childId as string),
    enabled: childId !== null,
  });
}

/** milestone_id → "4 months, 2 weeks" (age at the earliest matching moment). */
export function achievedAgeTexts(
  moments: MomentSummary[],
  dateOfBirth: string,
): Record<string, string> {
  const earliest: Record<string, string> = {};
  for (const m of moments) {
    if (m.milestone_id === null) continue;
    const existing = earliest[m.milestone_id];
    if (existing === undefined || m.occurred_on < existing) {
      earliest[m.milestone_id] = m.occurred_on;
    }
  }
  const out: Record<string, string> = {};
  for (const [id, occurredOn] of Object.entries(earliest)) {
    out[id] = formatAgeParts(ageParts(dateOfBirth, occurredOn));
  }
  return out;
}
