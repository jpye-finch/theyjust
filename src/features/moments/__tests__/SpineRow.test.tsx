import { render, screen, userEvent } from '@testing-library/react-native';
import { SpineRow } from '../SpineRow';
import type { SpineRow as Row } from '../spineLayout';

const row: Row = {
  key: 'm1',
  kind: 'moment',
  momentId: 'm1',
  date: '2026-07-08',
  title: 'Crawled',
  height: 120,
  offset: 0,
  dateLabel: '8 Jul',
  yearLabel: '2026',
};

describe('SpineRow', () => {
  it('shows the date and the title', async () => {
    await render(<SpineRow row={row} photoUrl={null} onPress={jest.fn()} />);
    expect(screen.getByText('8 Jul')).toBeTruthy();
    expect(screen.getByText('2026')).toBeTruthy();
    expect(screen.getByText('Crawled')).toBeTruthy();
  });

  it('shows a thumbnail only when the moment has one', async () => {
    const { rerender } = await render(<SpineRow row={row} photoUrl={null} onPress={jest.fn()} />);
    expect(screen.queryByTestId('spine-thumb')).toBeNull();

    await rerender(<SpineRow row={row} photoUrl="https://example.test/a.jpg" onPress={jest.fn()} />);
    expect(screen.getByTestId('spine-thumb').props.source).toEqual({
      uri: 'https://example.test/a.jpg',
    });
  });

  it('opens the moment when tapped', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<SpineRow row={row} photoUrl={null} onPress={onPress} />);
    await user.press(screen.getByText('Crawled'));
    expect(onPress).toHaveBeenCalled();
  });

  it('renders an age divider as a row of its own', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <SpineRow
        row={{
          ...row,
          kind: 'rule',
          key: 'rule-2025-06-22',
          momentId: null,
          title: '1 month old',
          dateLabel: null,
          yearLabel: null,
        }}
        photoUrl={null}
        onPress={onPress}
      />,
    );
    expect(screen.getByText('1 month old')).toBeTruthy();
    // A divider is scenery: nothing to open, and no date of its own.
    expect(screen.queryByText('8 Jul')).toBeNull();
    await user.press(screen.getByText('1 month old'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders no date at all when the row repeats the day above it', async () => {
    await render(
      <SpineRow
        row={{ ...row, dateLabel: null, yearLabel: null }}
        photoUrl={null}
        onPress={jest.fn()}
      />,
    );
    expect(screen.queryByText('8 Jul')).toBeNull();
    expect(screen.queryByText('2026')).toBeNull();
    // The title still renders — only the repeated date is withheld.
    expect(screen.getByText('Crawled')).toBeTruthy();
  });

  it('does not offer the Born anchor as something to open', async () => {
    // There is no moment behind it, so it must not look tappable.
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <SpineRow
        row={{ ...row, key: 'born', kind: 'born', momentId: null, title: 'Born' }}
        photoUrl={null}
        onPress={onPress}
      />,
    );
    await user.press(screen.getByText('Born'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
