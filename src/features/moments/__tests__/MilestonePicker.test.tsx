import { render, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MilestonePicker } from '../MilestonePicker';

// An iPhone with a Dynamic Island. The picker is a full-screen Modal, so it
// owns its own top inset — nothing above it is holding its header clear.
const IPHONE = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

const renderPicker = (ui: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={IPHONE}>{ui}</SafeAreaProvider>);

const props = { visible: true, onSelect: jest.fn(), onClose: jest.fn() };

afterEach(() => jest.clearAllMocks());

describe('MilestonePicker', () => {
  it('lists the catalogue by category', async () => {
    await renderPicker(<MilestonePicker {...props} />);
    expect(screen.getByText('Motor')).toBeTruthy();
    expect(screen.getByText('Crawled')).toBeTruthy();
  });

  it('filters as you search', async () => {
    const user = userEvent.setup();
    await renderPicker(<MilestonePicker {...props} />);
    await user.type(screen.getByLabelText('Search'), 'crawl');
    expect(screen.getByText('Crawled')).toBeTruthy();
    expect(screen.queryByText('First smile')).toBeNull();
  });

  it('clears the notch rather than sitting under it', async () => {
    // A fixed 32pt top padding put "Choose a milestone" under the Dynamic
    // Island and "Cancel" under the battery, on every modern iPhone. The
    // browser preview has no notch, so it could never have shown this.
    await renderPicker(<MilestonePicker {...props} />);
    const padding = StyleSheet.flatten(
      screen.getByTestId('picker-header').props.style,
    ).paddingTop;
    expect(padding).toBeGreaterThanOrEqual(IPHONE.insets.top);
  });
});
