import { render, screen, userEvent } from '@testing-library/react-native';
import type { Moment } from '../momentQueries';
import { SpineTimeline } from '../SpineTimeline';

const moment = (id: string, occurredOn: string, title: string): Moment => ({
  id,
  child_id: 'c1',
  milestone_id: null,
  custom_title: title,
  occurred_on: occurredOn,
  note: null,
  logged_by: 'u1',
  created_at: `${occurredOn}T00:00:00.000Z`,
  moment_photos: [],
});

describe('SpineTimeline', () => {
  it('draws the anchor and every moment, oldest first', async () => {
    await render(
      <SpineTimeline
        dateOfBirth="2025-05-22"
        dueDate={null}
        moments={[moment('m2', '2025-07-10', 'Later'), moment('m1', '2025-05-29', 'Sooner')]}
        photoUrls={{}}
        onOpenMoment={jest.fn()}
      />,
    );
    expect(screen.getByText('Born')).toBeTruthy();
    expect(screen.getByText('Sooner')).toBeTruthy();
    expect(screen.getByText('Later')).toBeTruthy();
  });

  it('opens the moment that was tapped', async () => {
    const onOpenMoment = jest.fn();
    const user = userEvent.setup();
    await render(
      <SpineTimeline
        dateOfBirth="2025-05-22"
        dueDate={null}
        moments={[moment('m1', '2025-05-29', 'Sooner')]}
        photoUrls={{}}
        onOpenMoment={onOpenMoment}
      />,
    );
    await user.press(screen.getByText('Sooner'));
    expect(onOpenMoment).toHaveBeenCalledWith('m1');
  });

  it('passes each moment its own photo', async () => {
    await render(
      <SpineTimeline
        dateOfBirth="2025-05-22"
        dueDate={null}
        moments={[moment('m1', '2025-05-29', 'Sooner')]}
        photoUrls={{ m1: 'https://example.test/a.jpg' }}
        onOpenMoment={jest.fn()}
      />,
    );
    expect(screen.getByTestId('spine-thumb').props.source).toEqual({
      uri: 'https://example.test/a.jpg',
    });
  });
});
