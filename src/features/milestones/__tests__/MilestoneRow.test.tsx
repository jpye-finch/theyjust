import { render, screen } from '@testing-library/react-native';
import { CATALOGUE } from '../catalogue';
import { MilestoneRow } from '../MilestoneRow';

const firstSteps = CATALOGUE.find((e) => e.id === 'first_steps')!;

describe('MilestoneRow', () => {
  it('renders an achieved milestone with a tick and age', async () => {
    await render(<MilestoneRow entry={firstSteps} achievedAgeText="13 months" />);
    expect(screen.getByText('✓ First steps')).toBeTruthy();
    expect(screen.getByText('At 13 months')).toBeTruthy();
  });

  it('renders the typical range when unachieved', async () => {
    await render(<MilestoneRow entry={firstSteps} achievedAgeText={null} />);
    expect(screen.getByText('First steps')).toBeTruthy();
    // 9–18 is the researched, sourced range from Plan 2 (WHO 5th percentile).
    expect(screen.getByText('Typically emerges between 9 and 18 months')).toBeTruthy();
  });

  it('says the same thing whatever the child’s age', async () => {
    // A row used to grow a worried sentence once the child passed its window.
    // That guidance now sits once at the top of the screen, so a row reads the
    // same at five months as at five years — it is a description, not a verdict.
    await render(<MilestoneRow entry={firstSteps} achievedAgeText={null} />);
    expect(screen.queryByText(/doctor or health visitor/)).toBeNull();
    expect(screen.queryByText(/Every child is different/)).toBeNull();
  });
});
