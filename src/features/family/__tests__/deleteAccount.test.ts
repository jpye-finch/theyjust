import { supabase } from '../../../lib/supabase';
import { deleteAccount } from '../deleteAccount';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
    auth: { signOut: jest.fn() },
  },
}));

const mockedInvoke = supabase.functions.invoke as jest.Mock;
const mockedSignOut = supabase.auth.signOut as jest.Mock;

afterEach(() => jest.clearAllMocks());

describe('deleteAccount', () => {
  it('calls the edge function and then signs the user out', async () => {
    mockedInvoke.mockResolvedValue({ data: { deleted: true }, error: null });
    await deleteAccount();
    expect(mockedInvoke).toHaveBeenCalledWith('delete-account', { method: 'POST' });
    expect(mockedSignOut).toHaveBeenCalled();
  });

  it('throws and does NOT sign out when deletion failed', async () => {
    mockedInvoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(deleteAccount()).rejects.toThrow('boom');
    // Signing out on a failed delete would lock the parent out of an account
    // that still exists, with no way back in to try again.
    expect(mockedSignOut).not.toHaveBeenCalled();
  });
});
