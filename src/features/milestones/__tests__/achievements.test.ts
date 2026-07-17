import { achievedAgeTexts } from '../achievements';

describe('achievedAgeTexts', () => {
  it('maps catalogue moments to formatted achievement ages', () => {
    const map = achievedAgeTexts(
      [
        { milestone_id: 'rolled_over', occurred_on: '2026-05-29' },
        { milestone_id: null, occurred_on: '2026-06-01' },
      ],
      '2026-01-15',
    );
    expect(map).toEqual({ rolled_over: '4 months, 2 weeks' });
  });

  it('keeps the earliest occurrence when duplicates exist', () => {
    const map = achievedAgeTexts(
      [
        { milestone_id: 'rolled_over', occurred_on: '2026-06-29' },
        { milestone_id: 'rolled_over', occurred_on: '2026-05-29' },
      ],
      '2026-01-15',
    );
    expect(map).toEqual({ rolled_over: '4 months, 2 weeks' });
  });

  it('returns an empty map for no moments', () => {
    expect(achievedAgeTexts([], '2026-01-15')).toEqual({});
  });

  it('maps several distinct milestones in one pass', () => {
    const map = achievedAgeTexts(
      [
        { milestone_id: 'rolled_over', occurred_on: '2026-05-29' },
        { milestone_id: 'first_smile', occurred_on: '2026-03-01' },
      ],
      '2026-01-15',
    );
    expect(map).toEqual({
      rolled_over: '4 months, 2 weeks',
      first_smile: '1 month, 2 weeks',
    });
  });
});
