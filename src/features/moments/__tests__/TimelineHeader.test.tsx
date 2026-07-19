import { render, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Child } from '../../children/queries';
import { TimelineHeader } from '../TimelineHeader';

// An iPhone with a Dynamic Island. The header reads the top inset so its
// content clears it; in a bare test render there is no provider to read from.
const IPHONE = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

const renderHeader = (ui: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={IPHONE}>{ui}</SafeAreaProvider>);

const mabel: Child = {
  id: 'c1',
  family_id: 'f1',
  name: 'Mabel',
  date_of_birth: '2025-05-22',
  due_date: null,
};

const props = {
  childrenList: [mabel],
  selected: mabel,
  onSelectChild: jest.fn(),
  onAddChild: jest.fn(),
  onSelectView: jest.fn(),
  onCapture: jest.fn(),
};

afterEach(() => jest.clearAllMocks());

describe('TimelineHeader', () => {
  it('leads with the child, not a wordmark', async () => {
    await renderHeader(<TimelineHeader {...props} view="list" />);
    expect(screen.getByText('Mabel')).toBeTruthy();
    // The wordmark told a reader nothing they did not already know.
    expect(screen.queryByText('TheyJust')).toBeNull();
  });

  it('offers the spine when the list is showing', async () => {
    const onSelectView = jest.fn();
    const user = userEvent.setup();
    await renderHeader(<TimelineHeader {...props} view="list" onSelectView={onSelectView} />);
    // One button, labelled for where it takes you — not two to compare.
    await user.press(screen.getByLabelText('Switch to timeline view'));
    expect(onSelectView).toHaveBeenCalledWith('spine');
    expect(screen.queryByLabelText('Switch to list view')).toBeNull();
  });

  it('offers the list when the spine is showing', async () => {
    const onSelectView = jest.fn();
    const user = userEvent.setup();
    await renderHeader(<TimelineHeader {...props} view="spine" onSelectView={onSelectView} />);
    await user.press(screen.getByLabelText('Switch to list view'));
    expect(onSelectView).toHaveBeenCalledWith('list');
    expect(screen.queryByLabelText('Switch to timeline view')).toBeNull();
  });

  it('still opens capture', async () => {
    const onCapture = jest.fn();
    const user = userEvent.setup();
    await renderHeader(<TimelineHeader {...props} view="list" onCapture={onCapture} />);
    await user.press(screen.getByLabelText('Capture a moment'));
    expect(onCapture).toHaveBeenCalled();
  });

  it('clears the notch rather than sitting under it', async () => {
    // A fixed 24pt top padding put the child's name underneath the Dynamic
    // Island on every modern iPhone — and a browser has no notch, so the web
    // preview could never have shown it.
    await renderHeader(<TimelineHeader {...props} view="list" />);
    const header = screen.getByText('Mabel').parent?.parent?.parent?.parent;
    const padding = StyleSheet.flatten(header?.props.style).paddingTop;
    expect(padding).toBeGreaterThanOrEqual(IPHONE.insets.top);
  });
});
