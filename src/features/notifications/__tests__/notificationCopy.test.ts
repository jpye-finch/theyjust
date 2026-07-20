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
  it('names the child and counts in words', () => {
    expect(lookBackTitle('Wren', 2)).toBe('Wren, two months ago today');
    expect(lookBackTitle('Wren', 3)).toBe('Wren, three months ago today');
    expect(lookBackTitle('Wren', 6)).toBe('Wren, six months ago today');
    expect(lookBackTitle('Wren', 12)).toBe('Wren, a year ago today');
    expect(lookBackTitle('Wren', 18)).toBe('Wren, a year and a half ago today');
    expect(lookBackTitle('Wren', 24)).toBe('Wren, two years ago today');
  });

  it('carries the attribution, so the body never has to', () => {
    // Which child it was has to be said somewhere, and the body cannot say it:
    // a custom moment is the parent's own sentence, often already containing
    // the name.
    expect(lookBackTitle('Dave', 2)).toContain('Dave');
  });
});

describe('lookBackBody', () => {
  it('keeps the app’s own wording for a catalogue milestone', () => {
    // The body says exactly what the timeline says, so tapping the notification
    // lands on the row the parent just read. The name lives in the title.
    const rolled = moment({ milestone_id: 'rolled_over', custom_title: null });
    expect(lookBackBody(rolled)).toBe('Rolled over');
  });

  it('leaves a custom moment’s words completely alone', () => {
    expect(lookBackBody(moment())).toBe('First swim');
  });

  it('does not double a name the parent already wrote', () => {
    // The commonest shape of custom title. Prefixing the child would read
    // "Mabel Mabel did a pool on her potty".
    const written = moment({ custom_title: 'Mabel did a pool on her potty' });
    expect(lookBackBody(written)).toBe('Mabel did a pool on her potty');
  });

  it('falls back to the custom title if a milestone id is unknown', () => {
    // A catalogue entry could be renamed or removed; a notification must still
    // say something rather than crash.
    const orphan = moment({ milestone_id: 'not_in_catalogue', custom_title: 'Something' });
    expect(lookBackBody(orphan)).toBe('Something');
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
    lookBackBody(moment()),
    lookBackBody(moment({ milestone_id: 'rolled_over', custom_title: null })),
    ...[2, 3, 6, 12, 18, 24].map((m) => lookBackTitle('Wren', m)),
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
