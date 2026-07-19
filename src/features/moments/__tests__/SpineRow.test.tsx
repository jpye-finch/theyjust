import { render, screen, userEvent } from '@testing-library/react-native';
import { SpineRow } from '../SpineRow';
import type { SpineRow as Row } from '../spineLayout';

const row: Row = {
  key: 'm1',
  kind: 'moment',
  momentId: 'm1',
  date: '2026-07-08',
  title: 'They just crawled!',
  height: 120,
  offset: 0,
  rules: [],
  gapCaption: null,
};

describe('SpineRow', () => {
  it('shows the date and the title', async () => {
    await render(<SpineRow row={row} photoUrl={null} onPress={jest.fn()} />);
    expect(screen.getByText('08/07/2026')).toBeTruthy();
    expect(screen.getByText('They just crawled!')).toBeTruthy();
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
    await user.press(screen.getByText('They just crawled!'));
    expect(onPress).toHaveBeenCalled();
  });

  it('renders the rules and the caption that fall in its trailing space', async () => {
    await render(
      <SpineRow
        row={{
          ...row,
          rules: [{ label: '1 month old', offset: 40 }],
          gapCaption: { label: '7 weeks', offset: 60 },
        }}
        photoUrl={null}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByText('1 month old')).toBeTruthy();
    expect(screen.getByText('7 weeks')).toBeTruthy();
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
