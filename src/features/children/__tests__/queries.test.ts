import { createChild, ensureFamilyId, fetchChildren, updateChild } from '../queries';
import { supabase } from '../../../lib/supabase';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

const mockedRpc = supabase.rpc as jest.Mock;
const mockedFrom = supabase.from as jest.Mock;

afterEach(() => jest.clearAllMocks());

describe('ensureFamilyId', () => {
  it('returns the family id from the idempotent create_family RPC', async () => {
    mockedRpc.mockResolvedValue({ data: 'fam-1', error: null });
    await expect(ensureFamilyId()).resolves.toBe('fam-1');
    expect(mockedRpc).toHaveBeenCalledWith('create_family', { family_name: null });
  });

  it('throws on RPC error', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: new Error('nope') });
    await expect(ensureFamilyId()).rejects.toThrow('nope');
  });
});

describe('fetchChildren', () => {
  it('selects children ordered by creation', async () => {
    const order = jest.fn().mockResolvedValue({ data: [{ id: 'c1' }], error: null });
    mockedFrom.mockReturnValue({ select: () => ({ order }) });
    await expect(fetchChildren()).resolves.toEqual([{ id: 'c1' }]);
    expect(mockedFrom).toHaveBeenCalledWith('children');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true });
  });
});

describe('createChild', () => {
  it('ensures a family then inserts the child into it', async () => {
    mockedRpc.mockResolvedValue({ data: 'fam-1', error: null });
    const single = jest.fn().mockResolvedValue({ data: { id: 'c1' }, error: null });
    const insert = jest.fn().mockReturnValue({ select: () => ({ single }) });
    mockedFrom.mockReturnValue({ insert });

    const child = await createChild({ name: 'Aria', dateOfBirth: '2026-01-01', dueDate: null });

    expect(child).toEqual({ id: 'c1' });
    expect(insert).toHaveBeenCalledWith({
      family_id: 'fam-1',
      name: 'Aria',
      date_of_birth: '2026-01-01',
      due_date: null,
    });
  });
});

describe('updateChild', () => {
  it('updates the child by id with snake_case columns', async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: 'c1' }, error: null });
    const eq = jest.fn().mockReturnValue({ select: () => ({ single }) });
    const update = jest.fn().mockReturnValue({ eq });
    mockedFrom.mockReturnValue({ update });

    const child = await updateChild('c1', {
      name: 'Aria',
      dateOfBirth: '2026-01-01',
      dueDate: '2026-03-01',
    });

    expect(child).toEqual({ id: 'c1' });
    expect(mockedFrom).toHaveBeenCalledWith('children');
    expect(update).toHaveBeenCalledWith({
      name: 'Aria',
      date_of_birth: '2026-01-01',
      due_date: '2026-03-01',
    });
    expect(eq).toHaveBeenCalledWith('id', 'c1');
  });
});
