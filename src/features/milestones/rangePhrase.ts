// Spec §5 safety rules, encoded once:
//  - Achieved milestones are celebrated regardless of timing.
//  - Ranges are always "typically emerges…" — never deadlines, never "behind".
//  - A calm signpost appears only when the child's comparison age is more than
//    SIGNPOST_GRACE_MONTHS past the outer bound. We are not a screening tool.
import type { CatalogueEntry } from './catalogue';

export const SIGNPOST_TEXT =
  'Every child is different — if you have questions, your health visitor or GP is the right person to ask.';

const SIGNPOST_GRACE_MONTHS = 2;

export type MilestoneStatus =
  | { kind: 'achieved'; ageText: string }
  | { kind: 'range'; text: string }
  | { kind: 'range-with-signpost'; text: string; signpost: string };

export function rangeText(startMonths: number, endMonths: number): string {
  if (startMonths === 0) {
    return endMonths === 1
      ? 'Typically emerges in the first month'
      : `Typically emerges in the first ${endMonths} months`;
  }
  return `Typically emerges between ${startMonths} and ${endMonths} months`;
}

export function milestoneStatus(
  entry: Pick<CatalogueEntry, 'typicalStartMonths' | 'typicalEndMonths'>,
  comparisonMonths: number,
  achievedAgeText: string | null,
): MilestoneStatus {
  if (achievedAgeText !== null) {
    return { kind: 'achieved', ageText: achievedAgeText };
  }
  const text = rangeText(entry.typicalStartMonths, entry.typicalEndMonths);
  if (comparisonMonths > entry.typicalEndMonths + SIGNPOST_GRACE_MONTHS) {
    return { kind: 'range-with-signpost', text, signpost: SIGNPOST_TEXT };
  }
  return { kind: 'range', text };
}
