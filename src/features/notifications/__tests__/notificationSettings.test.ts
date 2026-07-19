import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useNotificationCadence } from '../notificationSettings';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedStorage.setItem.mockResolvedValue(undefined);
});

describe('useNotificationCadence', () => {
  it('starts weekly', async () => {
    mockedStorage.getItem.mockResolvedValue(null);
    const { result } = await renderHook(() => useNotificationCadence());
    await waitFor(() => expect(result.current.cadence).toBe('weekly'));
  });

  it('restores a stored choice', async () => {
    mockedStorage.getItem.mockResolvedValue('monthly');
    const { result } = await renderHook(() => useNotificationCadence());
    await waitFor(() => expect(result.current.cadence).toBe('monthly'));
  });

  it('remembers a change', async () => {
    mockedStorage.getItem.mockResolvedValue(null);
    const { result } = await renderHook(() => useNotificationCadence());
    await waitFor(() => expect(result.current.cadence).toBe('weekly'));

    // RNTL's act() returns a thenable even for a synchronous callback, and an
    // unawaited one leaks a broken act environment into the next test.
    await act(() => result.current.setCadence('off'));

    await waitFor(() => expect(result.current.cadence).toBe('off'));
    expect(mockedStorage.setItem).toHaveBeenCalledWith('notification-cadence', 'off');
  });

  it('ignores a value it does not recognise', async () => {
    // Including 'daily', which this app deliberately never offers.
    mockedStorage.getItem.mockResolvedValue('daily');
    const { result } = await renderHook(() => useNotificationCadence());
    await waitFor(() => expect(result.current.cadence).toBe('weekly'));
  });
});
