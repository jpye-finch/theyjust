import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useNotificationPermission } from '../permission';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedStorage.setItem.mockResolvedValue(undefined);
});

describe('useNotificationPermission', () => {
  it('does not ask a parent who has barely started', async () => {
    mockedStorage.getItem.mockResolvedValue(null);
    const { result } = await renderHook(() => useNotificationPermission(2));
    await waitFor(() => expect(result.current.shouldAsk).toBe(false));
  });

  it('asks once the app has shown what it is for', async () => {
    // Three captured moments: enough to have felt the point of it.
    mockedStorage.getItem.mockResolvedValue(null);
    const { result } = await renderHook(() => useNotificationPermission(3));
    await waitFor(() => expect(result.current.shouldAsk).toBe(true));
  });

  it('never asks twice', async () => {
    // One-shot: a second prompt cannot succeed and only annoys.
    mockedStorage.getItem.mockResolvedValue('true');
    const { result } = await renderHook(() => useNotificationPermission(10));
    await waitFor(() => expect(result.current.shouldAsk).toBe(false));
  });

  it('remembers that it asked', async () => {
    mockedStorage.getItem.mockResolvedValue(null);
    const { result } = await renderHook(() => useNotificationPermission(3));
    await waitFor(() => expect(result.current.shouldAsk).toBe(true));

    await act(() => result.current.markAsked());

    await waitFor(() => expect(result.current.shouldAsk).toBe(false));
    expect(mockedStorage.setItem).toHaveBeenCalledWith('notification-permission-asked', 'true');
  });
});
