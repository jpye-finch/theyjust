import { CATALOGUE, celebrationText } from '../milestones/catalogue';

type TitleInput = { milestone_id: string | null; custom_title: string | null };

// A moment is a catalogue milestone (celebration voice) XOR a custom title
// (verbatim). The unknown-id fallback should never fire for shipped data, but
// keeps a renamed/removed catalogue entry from showing a blank card.
export function momentTitle({ milestone_id, custom_title }: TitleInput): string {
  if (custom_title != null) return custom_title;
  const entry = CATALOGUE.find((e) => e.id === milestone_id);
  return entry ? celebrationText(entry) : 'A new milestone';
}
