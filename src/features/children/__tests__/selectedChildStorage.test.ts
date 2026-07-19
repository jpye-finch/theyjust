import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useStoredChildId } from '../selectedChildStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedStorage.setItem.mockResolvedValue(undefined);
});

describe('useStoredChildId', () => {
  it('starts with nothing stored, so the caller picks its own default', async () => {
    mockedStorage.getItem.mockResolvedValue(null);
    const { result } = await renderHook(() => useStoredChildId());
    await waitFor(() => expect(result.current.storedId).toBeNull());
  });

  it('restores the child that was last being read', async () => {
    mockedStorage.getItem.mockResolvedValue('c2');
    const { result } = await renderHook(() => useStoredChildId());
    await waitFor(() => expect(result.current.storedId).toBe('c2'));
  });

  it('remembers a change', async () => {
    mockedStorage.getItem.mockResolvedValue(null);
    const { result } = await renderHook(() => useStoredChildId());
    await waitFor(() => expect(result.current.storedId).toBeNull());

    // RNTL's act() returns a thenable even for a synchronous callback, and an
    // unawaited one leaks a broken act environment into the next test.
    await act(() => result.current.storeId('c3'));

    await waitFor(() => expect(result.current.storedId).toBe('c3'));
    expect(mockedStorage.setItem).toHaveBeenCalledWith('selected-child', 'c3');
  });

  it('never writes on its own', async () => {
    // Only an explicit choice persists. Writing during hydration would overwrite
    // the stored child with whichever one happened to load first.
    mockedStorage.getItem.mockResolvedValue('c2');
    const { result } = await renderHook(() => useStoredChildId());
    await waitFor(() => expect(result.current.storedId).toBe('c2'));
    expect(mockedStorage.setItem).not.toHaveBeenCalled();
  });
});
