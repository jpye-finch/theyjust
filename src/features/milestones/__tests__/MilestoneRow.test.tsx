import { render, screen } from '@testing-library/react-native';
import { CATALOGUE } from '../catalogue';
import { MilestoneRow } from '../MilestoneRow';
import { SIGNPOST_TEXT } from '../rangePhrase';

const firstSteps = CATALOGUE.find((e) => e.id === 'first_steps')!;

describe('MilestoneRow', () => {
  it('renders an achieved milestone with a tick and age', async () => {
    await render(<MilestoneRow entry={firstSteps} comparisonMonths={14} achievedAgeText="13 months" />);
    expect(screen.getByText('✓ First steps')).toBeTruthy();
    expect(screen.getByText('At 13 months')).toBeTruthy();
  });

  it('renders the typical range when unachieved', async () => {
    await render(<MilestoneRow entry={firstSteps} comparisonMonths={5} achievedAgeText={null} />);
    expect(screen.getByText('First steps')).toBeTruthy();
    // 9–18 is the researched, sourced range from Task 5 (WHO 5th percentile).
    expect(screen.getByText('Typically emerges between 9 and 18 months')).toBeTruthy();
    expect(screen.queryByText(SIGNPOST_TEXT)).toBeNull();
  });

  it('renders the gentle signpost well past the window', async () => {
    await render(<MilestoneRow entry={firstSteps} comparisonMonths={21} achievedAgeText={null} />);
    expect(screen.getByText(SIGNPOST_TEXT)).toBeTruthy();
  });
});
