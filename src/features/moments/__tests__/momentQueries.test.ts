import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import {
  createMoment,
  deleteMoment,
  fetchTimeline,
  updateMoment,
  useCreateMoment,
  useDeleteMoment,
  useUpdateMoment,
} from '../momentQueries';
import { supabase } from '../../../lib/supabase';

function withClient(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn() } },
}));

const mockedFrom = supabase.from as jest.Mock;
const mockedGetSession = supabase.auth.getSession as jest.Mock;

afterEach(() => jest.clearAllMocks());

describe('fetchTimeline', () => {
  it('selects a child\'s moments with photos, newest first', async () => {
    const order = jest.fn().mockResolvedValue({ data: [{ id: 'm1', moment_photos: [] }], error: null });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    mockedFrom.mockReturnValue({ select });

    await expect(fetchTimeline('child-1')).resolves.toEqual([{ id: 'm1', moment_photos: [] }]);
    expect(mockedFrom).toHaveBeenCalledWith('moments');
    expect(select).toHaveBeenCalledWith('*, moment_photos(*)');
    expect(eq).toHaveBeenCalledWith('child_id', 'child-1');
    expect(order).toHaveBeenCalledWith('occurred_on', { ascending: false });
  });
});

describe('createMoment', () => {
  it('stamps logged_by from the signed-in user and inserts', async () => {
    mockedGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
    const single = jest.fn().mockResolvedValue({ data: { id: 'm1' }, error: null });
    const insert = jest.fn().mockReturnValue({ select: () => ({ single }) });
    mockedFrom.mockReturnValue({ insert });

    const moment = await createMoment({
      childId: 'child-1',
      milestoneId: 'rolled_over',
      customTitle: null,
      occurredOn: '2026-05-01',
      note: 'flipped right over',
    });

    expect(moment).toEqual({ id: 'm1' });
    expect(insert).toHaveBeenCalledWith({
      child_id: 'child-1',
      milestone_id: 'rolled_over',
      custom_title: null,
      occurred_on: '2026-05-01',
      note: 'flipped right over',
      logged_by: 'user-1',
    });
  });

  it('throws if there is no signed-in user', async () => {
    mockedGetSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(
      createMoment({ childId: 'c', milestoneId: 'x', customTitle: null, occurredOn: '2026-01-01', note: '' }),
    ).rejects.toThrow('Not signed in');
  });
});

describe('updateMoment', () => {
  it('updates only the editable columns', async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: 'm1' }, error: null });
    const eq = jest.fn().mockReturnValue({ select: () => ({ single }) });
    const update = jest.fn().mockReturnValue({ eq });
    mockedFrom.mockReturnValue({ update });

    await updateMoment('m1', { occurredOn: '2026-05-02', note: 'edited' });
    expect(update).toHaveBeenCalledWith({ occurred_on: '2026-05-02', note: 'edited' });
    expect(eq).toHaveBeenCalledWith('id', 'm1');
  });
});

describe('deleteMoment', () => {
  it('deletes by id', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn().mockReturnValue({ eq });
    mockedFrom.mockReturnValue({ delete: del });

    await deleteMoment('m1');
    expect(mockedFrom).toHaveBeenCalledWith('moments');
    expect(eq).toHaveBeenCalledWith('id', 'm1');
  });
});

// A moment change feeds two different query keys: the Timeline feed
// (['timeline']) and the Milestones "achieved" state (['moments'] via
// useMomentSummaries). Every mutation must invalidate BOTH or the Milestones
// screen goes stale (a logged milestone stays tappable → duplicate).
describe('mutation hooks invalidate both moment views', () => {
  it('useCreateMoment invalidates timeline and moments', async () => {
    mockedGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
    const single = jest.fn().mockResolvedValue({ data: { id: 'm1' }, error: null });
    mockedFrom.mockReturnValue({ insert: () => ({ select: () => ({ single }) }) });
    const client = new QueryClient();
    const invalidate = jest.spyOn(client, 'invalidateQueries');

    const { result } = await renderHook(() => useCreateMoment('child-1'), { wrapper: withClient(client) });
    await result.current.mutateAsync({
      childId: 'child-1',
      milestoneId: null,
      customTitle: 'First haircut',
      occurredOn: '2026-01-01',
      note: '',
    });

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['timeline', 'child-1'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['moments', 'child-1'] });
    });
  });

  it('useUpdateMoment invalidates timeline and moments', async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: 'm1' }, error: null });
    mockedFrom.mockReturnValue({ update: () => ({ eq: () => ({ select: () => ({ single }) }) }) });
    const client = new QueryClient();
    const invalidate = jest.spyOn(client, 'invalidateQueries');

    const { result } = await renderHook(() => useUpdateMoment('child-1'), { wrapper: withClient(client) });
    await result.current.mutateAsync({ id: 'm1', edit: { occurredOn: '2026-01-02', note: 'x' } });

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['timeline', 'child-1'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['moments', 'child-1'] });
    });
  });

  it('useDeleteMoment invalidates timeline and moments', async () => {
    mockedFrom.mockReturnValue({ delete: () => ({ eq: jest.fn().mockResolvedValue({ error: null }) }) });
    const client = new QueryClient();
    const invalidate = jest.spyOn(client, 'invalidateQueries');

    const { result } = await renderHook(() => useDeleteMoment('child-1'), { wrapper: withClient(client) });
    await result.current.mutateAsync('m1');

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['timeline', 'child-1'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['moments', 'child-1'] });
    });
  });
});
