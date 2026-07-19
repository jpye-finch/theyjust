import type { Moment } from '../../moments/momentQueries';
import { AGE_BODY, ageTitle, lookBackBody, lookBackTitle } from '../notificationCopy';

const moment = (overrides: Partial<Moment> = {}): Moment => ({
  id: 'm1',
  child_id: 'c1',
  milestone_id: null,
  custom_title: 'First swim',
  occurred_on: '2026-05-10',
  note: null,
  logged_by: 'u1',
  created_at: '2026-05-10T00:00:00.000Z',
  moment_photos: [],
  ...overrides,
});

describe('lookBackTitle', () => {
  it('counts in words, because there are only six of them', () => {
    expect(lookBackTitle(2)).toBe('Two months ago today');
    expect(lookBackTitle(3)).toBe('Three months ago today');
    expect(lookBackTitle(6)).toBe('Six months ago today');
    expect(lookBackTitle(12)).toBe('A year ago today');
    expect(lookBackTitle(18)).toBe('A year and a half ago today');
    expect(lookBackTitle(24)).toBe('Two years ago today');
  });
});

describe('lookBackBody', () => {
  it('names the child rather than saying "they"', () => {
    // momentTitle() would give "They just rolled over!", and "they" is ambiguous
    // the moment a family has two children.
    const rolled = moment({ milestone_id: 'rolled_over', custom_title: null });
    expect(lookBackBody('Wren', rolled)).toBe('Wren rolled over.');
  });

  it('uses a custom moment’s own words, untouched', () => {
    expect(lookBackBody('Wren', moment())).toBe('First swim');
  });

  it('falls back to the custom title if a milestone id is unknown', () => {
    // A catalogue entry could be renamed or removed; a notification must still
    // say something rather than crash or read "Wren undefined.".
    const orphan = moment({ milestone_id: 'not_in_catalogue', custom_title: 'Something' });
    expect(lookBackBody('Wren', orphan)).toBe('Something');
  });
});

describe('ageTitle', () => {
  it('states the age plainly', () => {
    expect(ageTitle('Wren', '7 months')).toBe('Wren is 7 months old today');
    expect(ageTitle('Wren', '2 years')).toBe('Wren is 2 years old today');
  });
});

describe('the copy rules from spec §3', () => {
  // The rule is that a notification is about the child, never about the parent.
  // These assertions are the rule, executable.
  const everyString = [
    AGE_BODY,
    ageTitle('Wren', '7 months'),
    lookBackBody('Wren', moment()),
    lookBackBody('Wren', moment({ milestone_id: 'rolled_over', custom_title: null })),
    ...[2, 3, 6, 12, 18, 24].map(lookBackTitle),
  ];

  it('never addresses the parent’s behaviour', () => {
    for (const text of everyString) {
      expect(text.toLowerCase()).not.toMatch(/you haven|you still|forgot|missed|remember to/);
    }
  });

  it('never implies a deadline or a comparison', () => {
    for (const text of everyString) {
      expect(text.toLowerCase()).not.toMatch(/should|behind|yet\b|other babies|most babies|on track/);
    }
  });

  it('invites without naming anything the child ought to be doing', () => {
    expect(AGE_BODY).toBe('Anything you’d like to remember?');
  });
});
