import type { Moment } from '../moments/momentQueries';
import { momentTitle } from '../moments/momentText';

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

/**
 * "Mabel, two months ago today".
 *
 * The child is named HERE rather than in the body, and that placement is doing
 * real work in two directions:
 *
 *  - A catalogue moment can then keep the app's own wording — "They just took
 *    their first steps!" — which is already grammatical. Building a sentence
 *    around the name instead produced "Mabel took their first steps", because
 *    the catalogue's verb phrases are written to follow "They just …".
 *  - A custom moment is the parent's own sentence and must not be touched. Many
 *    already contain the name ("Mabel did a pool on her potty"), so prefixing
 *    one would read "Mabel Mabel did a pool on her potty" — while leaving it
 *    bare says nothing about which child it was.
 *
 * Attribution in the title, the moment in the body, and neither interferes with
 * the other.
 */
export function lookBackTitle(childName: string, months: number): string {
  return `${childName}, ${(INTERVAL_WORDS[months] ?? `${months} months`).toLowerCase()} ago today`;
}

/** The moment exactly as it reads on the timeline — the parent's words, or ours. */
export function lookBackBody(moment: Moment): string {
  return momentTitle(moment);
}

export function ageTitle(childName: string, ageText: string): string {
  return `${childName} is ${ageText} old today`;
}

/** Open-ended on purpose: never names a thing the child ought to be doing. */
export const AGE_BODY = 'Anything you’d like to remember?';
