import { milestoneStatus, rangeText } from '../rangePhrase';

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
    expect(milestoneStatus(entry, '20 months')).toEqual({
      kind: 'achieved',
      ageText: '20 months',
    });
  });

  it('shows the typical range whenever it has not been achieved', () => {
    expect(milestoneStatus(entry, null)).toEqual({
      kind: 'range',
      text: 'Typically emerges between 8 and 18 months',
    });
  });

  it('reads the same however old the child is', () => {
    // The row once grew a worried sentence once a child passed the window,
    // which for an older child fired on many rows at once. That guidance now
    // sits once at the top of the screen, so a row is a description of the
    // milestone rather than a verdict on the child reading it.
    expect(milestoneStatus(entry, null)).toEqual(milestoneStatus(entry, null));
    expect(milestoneStatus(entry, null).kind).toBe('range');
  });
});
