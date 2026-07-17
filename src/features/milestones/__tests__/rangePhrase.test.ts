import { milestoneStatus, rangeText, SIGNPOST_TEXT } from '../rangePhrase';

const entry = {
  id: 'first_steps',
  title: 'First steps',
  verbPhrase: 'took their first steps',
  category: 'motor' as const,
  typicalStartMonths: 8,
  typicalEndMonths: 18,
  context: 'Walking has one of the widest healthy windows of any milestone.',
  sources: ['https://www.who.int/x', 'https://www.cdc.gov/y'],
};

describe('rangeText', () => {
  it('phrases a range', () => {
    expect(rangeText(8, 18)).toBe('Typically emerges between 8 and 18 months');
  });

  it('phrases from-birth ranges without a zero', () => {
    expect(rangeText(0, 3)).toBe('Typically emerges in the first 3 months');
  });

  it('uses singular month', () => {
    expect(rangeText(0, 1)).toBe('Typically emerges in the first month');
  });

  it('phrases toddler ranges in years, matching how ages display past 24 months', () => {
    expect(rangeText(30, 48)).toBe('Typically emerges between 2½ and 4 years');
    expect(rangeText(24, 36)).toBe('Typically emerges between 2 and 3 years');
    expect(rangeText(18, 30)).toBe('Typically emerges between 18 months and 2½ years');
  });
});

describe('milestoneStatus', () => {
  it('celebrates achieved milestones regardless of timing', () => {
    expect(milestoneStatus(entry, 30, '20 months')).toEqual({
      kind: 'achieved',
      ageText: '20 months',
    });
  });

  it('shows the range before and inside the window', () => {
    expect(milestoneStatus(entry, 5, null)).toEqual({
      kind: 'range',
      text: 'Typically emerges between 8 and 18 months',
    });
    expect(milestoneStatus(entry, 18, null).kind).toBe('range');
  });

  it('stays calm up to two months past the outer bound', () => {
    expect(milestoneStatus(entry, 20, null).kind).toBe('range');
  });

  it('adds the gentle signpost beyond outer bound + 2 months', () => {
    expect(milestoneStatus(entry, 20.1, null)).toEqual({
      kind: 'range-with-signpost',
      text: 'Typically emerges between 8 and 18 months',
      signpost: SIGNPOST_TEXT,
    });
  });

  it('never signposts commonly-skipped milestones', () => {
    expect(milestoneStatus({ ...entry, skippable: true }, 25, null).kind).toBe('range');
  });
});
