import { CATALOGUE } from '../milestones/catalogue';
import type { Moment } from '../moments/momentQueries';

// Every string a parent can receive lives here, so the rule in spec §3 — about
// the child, never about the parent — can be asserted in one place.

const INTERVAL_WORDS: Record<number, string> = {
  2: 'Two months',
  3: 'Three months',
  6: 'Six months',
  12: 'A year',
  18: 'A year and a half',
  24: 'Two years',
};

/** "Two months ago today". Words rather than numerals: there are only six. */
export function lookBackTitle(months: number): string {
  return `${INTERVAL_WORDS[months] ?? `${months} months`} ago today`;
}

/**
 * "Wren rolled over." — the child is named, because momentTitle's "They just …"
 * is ambiguous as soon as a family has two children.
 */
export function lookBackBody(childName: string, moment: Moment): string {
  const entry = moment.milestone_id
    ? CATALOGUE.find((e) => e.id === moment.milestone_id)
    : undefined;
  if (entry) return `${childName} ${entry.verbPhrase}.`;
  // A custom moment is already in the parent's own words. An unknown milestone
  // id falls through to here rather than rendering "Wren undefined.".
  return moment.custom_title ?? '';
}

export function ageTitle(childName: string, ageText: string): string {
  return `${childName} is ${ageText} old today`;
}

/** Open-ended on purpose: never names a thing the child ought to be doing. */
export const AGE_BODY = 'Anything you’d like to remember?';
