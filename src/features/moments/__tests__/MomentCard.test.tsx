import { render, screen } from '@testing-library/react-native';
import { MomentCard } from '../MomentCard';

const base = {
  id: 'm1',
  child_id: 'c1',
  milestone_id: 'rolled_over',
  custom_title: null,
  occurred_on: '2026-05-29',
  note: 'flipped right over',
  logged_by: 'me',
  created_at: '2026-05-29',
  moment_photos: [],
};

describe('MomentCard', () => {
  it('shows the celebration title, age at the time, and note', async () => {
    await render(
      <MomentCard moment={base} childDateOfBirth="2026-01-15" loggedByYou photoUrl={null} />,
    );
    expect(screen.getByText('They just rolled over!')).toBeTruthy();
    // Date and age render as one meta line; getByText matches a Text's full content.
    expect(screen.getByText('2026-05-29 · 4 months, 2 weeks')).toBeTruthy();
    expect(screen.getByText('flipped right over')).toBeTruthy();
    expect(screen.getByText('Logged by you')).toBeTruthy();
  });

  it('uses a custom title and credits a co-parent', async () => {
    await render(
      <MomentCard
        moment={{ ...base, milestone_id: null, custom_title: 'First haircut', note: null }}
        childDateOfBirth="2026-01-15"
        loggedByYou={false}
        photoUrl={null}
      />,
    );
    expect(screen.getByText('First haircut')).toBeTruthy();
    expect(screen.getByText('Logged by a co-parent')).toBeTruthy();
  });
});
