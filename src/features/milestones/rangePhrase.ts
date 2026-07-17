// Spec §5 safety rules, encoded once:
//  - Achieved milestones are celebrated regardless of timing.
//  - Ranges are always "typically emerges…", never deadlines, never "behind".
//  - A calm signpost appears only when the child's comparison age is more than
//    SIGNPOST_GRACE_MONTHS past the outer bound. We are not a screening tool.
import type { CatalogueEntry } from './catalogue';

// Reads naturally in the US, UK, and Europe: "doctor" covers pediatrician /
// GP / Kinderarzt, and "health visitor" names the UK's usual first port of call.
export const SIGNPOST_TEXT =
  'Every child is different. If you have questions, your child’s doctor or health visitor is the right person to ask.';

const SIGNPOST_GRACE_MONTHS = 2;

export type MilestoneStatus =
  | { kind: 'achieved'; ageText: string }
  | { kind: 'range'; text: string }
  | { kind: 'range-with-signpost'; text: string; signpost: string };

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
  entry: Pick<CatalogueEntry, 'typicalStartMonths' | 'typicalEndMonths' | 'skippable'>,
  comparisonMonths: number,
  achievedAgeText: string | null,
): MilestoneStatus {
  if (achievedAgeText !== null) {
    return { kind: 'achieved', ageText: achievedAgeText };
  }
  const text = rangeText(entry.typicalStartMonths, entry.typicalEndMonths);
  // Skippable milestones (many children healthily never do them) must never
  // trigger the signpost — that would be exactly the false alarm we avoid.
  if (!entry.skippable && comparisonMonths > entry.typicalEndMonths + SIGNPOST_GRACE_MONTHS) {
    return { kind: 'range-with-signpost', text, signpost: SIGNPOST_TEXT };
  }
  return { kind: 'range', text };
}
