import { createMoment, deleteMoment, fetchTimeline, updateMoment } from '../momentQueries';
import { supabase } from '../../../lib/supabase';

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));

const mockedFrom = supabase.from as jest.Mock;
const mockedGetUser = supabase.auth.getUser as jest.Mock;

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
    mockedGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
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
    mockedGetUser.mockResolvedValue({ data: { user: null }, error: null });
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
