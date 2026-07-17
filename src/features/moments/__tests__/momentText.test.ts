import { momentTitle } from '../momentText';

describe('momentTitle', () => {
  it('uses the milestone celebration for a catalogue moment', () => {
    expect(momentTitle({ milestone_id: 'rolled_over', custom_title: null })).toBe(
      'They just rolled over!',
    );
  });

  it('uses the custom title verbatim for a custom moment', () => {
    expect(momentTitle({ milestone_id: null, custom_title: 'First haircut' })).toBe(
      'First haircut',
    );
  });

  it('falls back gracefully if a milestone id is unknown', () => {
    expect(momentTitle({ milestone_id: 'not_a_real_id', custom_title: null })).toBe(
      'A new milestone',
    );
  });
});
