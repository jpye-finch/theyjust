import { CATALOGUE } from '../milestones/catalogue';

type TitleInput = { milestone_id: string | null; custom_title: string | null };

// A moment is a catalogue milestone XOR a custom title (verbatim). The
// unknown-id fallback should never fire for shipped data, but keeps a
// renamed/removed catalogue entry from showing a blank card.
//
// The recorded title, not the celebration: "They just crawled!" was the old
// wordmark speaking inside the content, and once the app became Firsts it was
// quoting a name that no longer exists. It also said "they" on every row of a
// screen whose header says Mabel, repeated three words before the one that
// distinguished each entry, and sat oddly beside custom moments written in the
// parent's own words. The celebration voice still greets you in the capture
// sheet — that is where the delight is. This list is the record.
export function momentTitle({ milestone_id, custom_title }: TitleInput): string {
  if (custom_title != null) return custom_title;
  const entry = CATALOGUE.find((e) => e.id === milestone_id);
  return entry ? entry.title : 'A new milestone';
}
