import { render, screen, userEvent } from '@testing-library/react-native';
import { ChildSwitcher } from '../ChildSwitcher';
import type { Child } from '../queries';

const child = (id: string, name: string, dob: string): Child => ({
  id,
  family_id: 'f1',
  name,
  date_of_birth: dob,
  due_date: null,
});

// Ages are computed against "now", so pin it — otherwise these assertions rot.
beforeAll(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-07-19T12:00:00Z'));
});
afterAll(() => jest.useRealTimers());

const mabel = child('c1', 'Mabel', '2025-05-22');
const dave = child('c2', 'Dave', '2026-06-30');

describe('ChildSwitcher', () => {
  it('shows the selected child and their age', async () => {
    await render(
      <ChildSwitcher
        childrenList={[mabel, dave]}
        selected={mabel}
        onSelect={jest.fn()}
        onAddChild={jest.fn()}
      />,
    );
    expect(screen.getByText('Mabel')).toBeTruthy();
    expect(screen.getByText('13 months, 3 weeks')).toBeTruthy();
  });

  it('keeps the other children out of the way until asked', async () => {
    await render(
      <ChildSwitcher
        childrenList={[mabel, dave]}
        selected={mabel}
        onSelect={jest.fn()}
        onAddChild={jest.fn()}
      />,
    );
    expect(screen.queryByText('Dave')).toBeNull();
  });

  it('opens the menu and switches child', async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await render(
      <ChildSwitcher
        childrenList={[mabel, dave]}
        selected={mabel}
        onSelect={onSelect}
        onAddChild={jest.fn()}
      />,
    );
    await user.press(screen.getByLabelText('Mabel. Switch child'));
    // Each child carries their age, so the list is scannable.
    expect(screen.getByText('2 weeks')).toBeTruthy();
    await user.press(screen.getByLabelText('Show Dave'));
    expect(onSelect).toHaveBeenCalledWith('c2');
  });

  it('offers a way to add a child from the same menu', async () => {
    const onAddChild = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await render(
      <ChildSwitcher
        childrenList={[mabel]}
        selected={mabel}
        onSelect={jest.fn()}
        onAddChild={onAddChild}
      />,
    );
    await user.press(screen.getByLabelText('Mabel. Switch child'));
    await user.press(screen.getByText('Add another child'));
    expect(onAddChild).toHaveBeenCalled();
  });
});
