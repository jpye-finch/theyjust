// Spec §5 safety rules, encoded once:
//  - Achieved milestones are celebrated regardless of timing.
//  - Ranges are always "typically emerges…", never deadlines, never "behind".
//
// There was once a per-row signpost that appeared when a child passed a range.
// For an older child it fired on many rows at once, so the screen filled with
// the same worried sentence — the opposite of reassurance. That guidance now
// lives once, at the top of the Milestones screen, where it frames the whole
// list instead of shadowing individual rows. We are not a screening tool.
import type { CatalogueEntry } from './catalogue';

export type MilestoneStatus =
  | { kind: 'achieved'; ageText: string }
  | { kind: 'range'; text: string };

/** 24 → "2 years", 30 → "2½ years". Bounds ≥24 are validated to be ÷6. */
function yearsText(months: number): string {
  const whole = Math.floor(months / 12);
  return months % 12 === 6 ? `${whole}½ years` : `${whole} years`;
}

export function rangeText(startMonths: number, endMonths: number): string {
  if (startMonths === 0) {
    return endMonths === 1
      ? 'Typically emerges in the first month'
      : `Typically emerges in the first ${endMonths} months`;
  }
  if (endMonths < 24) {
    return `Typically emerges between ${startMonths} and ${endMonths} months`;
  }
  if (startMonths >= 24) {
    // "between 2½ and 4 years" — drop the unit from the first bound.
    return `Typically emerges between ${yearsText(startMonths).replace(' years', '')} and ${yearsText(endMonths)}`;
  }
  return `Typically emerges between ${startMonths} months and ${yearsText(endMonths)}`;
}

export function milestoneStatus(
  entry: Pick<CatalogueEntry, 'typicalStartMonths' | 'typicalEndMonths'>,
  achievedAgeText: string | null,
): MilestoneStatus {
  if (achievedAgeText !== null) {
    return { kind: 'achieved', ageText: achievedAgeText };
  }
  return { kind: 'range', text: rangeText(entry.typicalStartMonths, entry.typicalEndMonths) };
}
