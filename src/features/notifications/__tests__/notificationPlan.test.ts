import type { Child } from '../../children/queries';
import type { Moment } from '../../moments/momentQueries';
import { planNotifications } from '../notificationPlan';

const child = (id: string, name: string, dob: string): Child => ({
  id,
  family_id: 'f1',
  name,
  date_of_birth: dob,
  due_date: null,
});

const moment = (id: string, childId: string, occurredOn: string, title: string, photos = 0): Moment => ({
  id,
  child_id: childId,
  milestone_id: null,
  custom_title: title,
  occurred_on: occurredOn,
  note: null,
  logged_by: 'u1',
  created_at: `${occurredOn}T00:00:00.000Z`,
  moment_photos: Array.from({ length: photos }, (_, i) => ({
    id: `p${i}`,
    moment_id: id,
    storage_path: `${id}/p${i}.jpg`,
    width: 100,
    height: 80,
    position: i,
  })),
});

const TODAY = '2026-07-19';

describe('planNotifications', () => {
  it('sends nothing when reminders are off', () => {
    const wren = child('c1', 'Wren', '2026-01-15');
    expect(
      planNotifications({
        today: TODAY,
        children: [wren],
        momentsByChild: { c1: [] },
        cadence: 'off',
      }),
    ).toEqual([]);
  });

  it('sends nothing when there is no child yet', () => {
    expect(
      planNotifications({ today: TODAY, children: [], momentsByChild: {}, cadence: 'weekly' }),
    ).toEqual([]);
  });

  it('marks a monthly birthday', () => {
    const wren = child('c1', 'Wren', '2026-01-15');
    const plan = planNotifications({
      today: TODAY,
      children: [wren],
      momentsByChild: { c1: [] },
      cadence: 'weekly',
    });
    // 15 Aug is seven months after 15 Jan, and inside the eight-week window.
    expect(plan).toHaveLength(1);
    expect(plan[0].fireOn).toBe('2026-08-15');
    expect(plan[0].title).toBe('Wren is 7 months old today');
    expect(plan[0].body).toBe('Anything you’d like to remember?');
    expect(plan[0].momentId).toBeNull();
    expect(plan[0].key).toBe('age-c1-2026-08-15');
  });

  it('looks back at a moment two and three months on', () => {
    // A six-year-old has no monthly birthdays left, so only look-backs remain.
    const sol = child('c1', 'Sol', '2020-03-05');
    const plan = planNotifications({
      today: TODAY,
      children: [sol],
      momentsByChild: { c1: [moment('m1', 'c1', '2026-06-10', 'First swim')] },
      cadence: 'weekly',
    });
    expect(plan.map((n) => n.fireOn)).toEqual(['2026-08-10', '2026-09-10']);
    // The child is named in the title, so the body can be the moment exactly as
    // the parent wrote it.
    expect(plan[0].title).toBe('Sol, two months ago today');
    expect(plan[0].body).toBe('First swim');
    expect(plan[0].momentId).toBe('m1');
    expect(plan[0].key).toBe('look-m1-2');
  });

  it('never looks back only one month', () => {
    const sol = child('c1', 'Sol', '2020-03-05');
    const plan = planNotifications({
      today: TODAY,
      children: [sol],
      momentsByChild: { c1: [moment('m1', 'c1', '2026-07-01', 'Too recent')] },
      cadence: 'weekly',
    });
    // 1 Aug would be one month on. A month is not yet a memory.
    expect(plan.map((n) => n.fireOn)).not.toContain('2026-08-01');
  });

  it('schedules nothing for today or earlier', () => {
    const sol = child('c1', 'Sol', '2020-03-05');
    const plan = planNotifications({
      today: TODAY,
      children: [sol],
      // Two months on from this is 19 July — today. A notification for now is no
      // use: it would be scheduled in the past and never fire. The three-month
      // look-back on 19 August is still legitimate, so the plan is not empty —
      // it simply must not contain today.
      momentsByChild: { c1: [moment('m1', 'c1', '2026-05-19', 'Exactly today')] },
      cadence: 'weekly',
    });
    expect(plan.map((n) => n.fireOn)).toEqual(['2026-08-19']);
    expect(plan.every((n) => n.fireOn > TODAY)).toBe(true);
  });

  it('gives a week to the birthday when both fall in it', () => {
    const wren = child('c1', 'Wren', '2026-01-15');
    const plan = planNotifications({
      today: TODAY,
      children: [wren],
      // Two months on from 14 June is 14 Aug — the same week as the 15 Aug
      // birthday. An age moment happens once and cannot be deferred.
      momentsByChild: { c1: [moment('m1', 'c1', '2026-06-14', 'Same week')] },
      cadence: 'weekly',
    });
    const thatWeek = plan.filter((n) => n.fireOn >= '2026-08-10' && n.fireOn <= '2026-08-16');
    expect(thatWeek).toHaveLength(1);
    expect(thatWeek[0].title).toBe('Wren is 7 months old today');
  });

  it('prefers a moment that has a photo', () => {
    const sol = child('c1', 'Sol', '2020-03-05');
    const plan = planNotifications({
      today: TODAY,
      children: [sol],
      momentsByChild: {
        c1: [
          moment('m1', 'c1', '2026-06-10', 'No photo'),
          moment('m2', 'c1', '2026-06-11', 'Has a photo', 1),
        ],
      },
      cadence: 'weekly',
    });
    // 10 and 11 Aug are the same week; the one with something to look at wins.
    expect(plan[0].body).toBe('Has a photo');
  });

  it('prefers the longer look-back when nothing else separates them', () => {
    const sol = child('c1', 'Sol', '2020-03-05');
    const plan = planNotifications({
      today: TODAY,
      children: [sol],
      momentsByChild: {
        c1: [
          moment('m1', 'c1', '2026-06-10', 'Two months on'),
          moment('m2', 'c1', '2026-02-11', 'Six months on'),
        ],
      },
      cadence: 'weekly',
    });
    // Both land in the week of 10 Aug. Six months back lands harder than two.
    expect(plan[0].body).toBe('Six months on');
  });

  it('shares the weeks out between children', () => {
    // Twins, so every candidate collides and rotation is the only thing that can
    // separate them.
    const wren = child('c1', 'Wren', '2026-01-15');
    const sol = child('c2', 'Sol', '2026-01-15');
    const plan = planNotifications({
      today: TODAY,
      children: [wren, sol],
      momentsByChild: { c1: [], c2: [] },
      cadence: 'weekly',
      weeks: 12,
    });
    // One notification per week, never two — and the second child gets the next
    // one rather than being crowded out for ever.
    expect(plan.map((n) => n.fireOn)).toEqual(['2026-08-15', '2026-09-15']);
    expect(plan.map((n) => n.childId)).toEqual(['c1', 'c2']);
  });

  it('drops to one a month when asked', () => {
    const sol = child('c1', 'Sol', '2020-03-05');
    const plan = planNotifications({
      today: TODAY,
      children: [sol],
      momentsByChild: {
        c1: [
          moment('m1', 'c1', '2026-06-05', 'Early August'),
          moment('m2', 'c1', '2026-06-25', 'Late August'),
        ],
      },
      cadence: 'monthly',
      weeks: 12,
    });
    const august = plan.filter((n) => n.fireOn.startsWith('2026-08'));
    expect(august).toHaveLength(1);
  });

  it('fires at half past seven, after a bedtime', () => {
    const wren = child('c1', 'Wren', '2026-01-15');
    const plan = planNotifications({
      today: TODAY,
      children: [wren],
      momentsByChild: { c1: [] },
      cadence: 'weekly',
    });
    expect(plan[0].fireAtHour).toBe(19);
    expect(plan[0].fireAtMinute).toBe(30);
  });

  it('counts a premature baby’s months from their due date', () => {
    // Corrected age, as everywhere else in the app. Born 15 Jan, due 26 Feb: the
    // monthly marks land on the 26th, not the 15th, and that is the whole tell.
    const wren: Child = { ...child('c1', 'Wren', '2026-01-15'), due_date: '2026-02-26' };
    const plan = planNotifications({
      today: TODAY,
      children: [wren],
      momentsByChild: { c1: [] },
      cadence: 'weekly',
    });
    expect(plan.map((n) => n.fireOn)).toEqual(['2026-07-26', '2026-08-26']);
    expect(plan[0].title).toBe('Wren is 5 months old today');
  });

  it('stays inside its window', () => {
    const sol = child('c1', 'Sol', '2020-03-05');
    const plan = planNotifications({
      today: TODAY,
      children: [sol],
      // Two months on is 1 Aug, inside a two-week window; three months on is
      // 1 Sep, outside it. iOS allows only 64 pending local notifications, so
      // the scheduler windows rather than planning a child's whole future.
      momentsByChild: { c1: [moment('m1', 'c1', '2026-06-01', 'Inside')] },
      cadence: 'weekly',
      weeks: 2,
    });
    expect(plan.map((n) => n.fireOn)).toEqual(['2026-08-01']);
  });
});
