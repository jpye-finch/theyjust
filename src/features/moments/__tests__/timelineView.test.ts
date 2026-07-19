import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTimelineView } from '../timelineView';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedStorage.setItem.mockResolvedValue(undefined);
});

describe('useTimelineView', () => {
  it('starts on the list, which is the reading view', async () => {
    mockedStorage.getItem.mockResolvedValue(null);
    const { result } = await renderHook(() => useTimelineView());
    await waitFor(() => expect(result.current.view).toBe('list'));
  });

  it('restores the spine when that was the last choice', async () => {
    mockedStorage.getItem.mockResolvedValue('spine');
    const { result } = await renderHook(() => useTimelineView());
    await waitFor(() => expect(result.current.view).toBe('spine'));
  });

  it('remembers a change', async () => {
    mockedStorage.getItem.mockResolvedValue(null);
    const { result } = await renderHook(() => useTimelineView());
    await waitFor(() => expect(result.current.view).toBe('list'));

    await act(() => result.current.setView('spine'));

    await waitFor(() => expect(result.current.view).toBe('spine'));
    expect(mockedStorage.setItem).toHaveBeenCalledWith('timeline-view', 'spine');
  });

  it('ignores a stored value it does not recognise', async () => {
    // A corrupt or downgraded value must not render an unknown view.
    mockedStorage.getItem.mockResolvedValue('carousel');
    const { result } = await renderHook(() => useTimelineView());
    await waitFor(() => expect(result.current.view).toBe('list'));
  });
});
