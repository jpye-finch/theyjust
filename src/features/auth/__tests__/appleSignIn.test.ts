import * as AppleAuthentication from 'expo-apple-authentication';
import { signInWithApple } from '../appleSignIn';
import { supabase } from '../../../lib/supabase';

jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('../../../lib/supabase', () => ({
  supabase: { auth: { signInWithIdToken: jest.fn() } },
}));

const mockedSignIn = AppleAuthentication.signInAsync as jest.Mock;
const mockedIdToken = supabase.auth.signInWithIdToken as unknown as jest.Mock;

afterEach(() => jest.clearAllMocks());

describe('signInWithApple', () => {
  it('exchanges the identity token for a Supabase session', async () => {
    mockedSignIn.mockResolvedValue({ identityToken: 'jwt-from-apple' });
    mockedIdToken.mockResolvedValue({ error: null });

    expect(await signInWithApple()).toEqual({ status: 'signed-in' });
    expect(mockedIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'jwt-from-apple',
    });
  });

  it('treats a cancelled sheet as nothing happening, not an error', async () => {
    // Backing out of the Apple sheet is a decision, not a failure. Surfacing
    // it as an error message would tell a parent something went wrong when
    // they simply changed their mind.
    mockedSignIn.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });

    expect(await signInWithApple()).toEqual({ status: 'cancelled' });
    expect(mockedIdToken).not.toHaveBeenCalled();
  });

  it('reports a real Apple failure', async () => {
    mockedSignIn.mockRejectedValue(new Error('Apple is unreachable'));

    expect(await signInWithApple()).toEqual({
      status: 'failed',
      message: 'Apple is unreachable',
    });
  });

  it('refuses a credential with no identity token', async () => {
    // Apple's type marks identityToken nullable. Passing null to Supabase
    // would fail deeper in with a far less obvious message.
    mockedSignIn.mockResolvedValue({ identityToken: null });

    expect(await signInWithApple()).toEqual({
      status: 'failed',
      message: 'Apple did not return a sign-in token. Please try again.',
    });
    expect(mockedIdToken).not.toHaveBeenCalled();
  });

  it('surfaces a Supabase rejection', async () => {
    mockedSignIn.mockResolvedValue({ identityToken: 'jwt-from-apple' });
    mockedIdToken.mockResolvedValue({ error: { message: 'Provider not enabled' } });

    expect(await signInWithApple()).toEqual({
      status: 'failed',
      message: 'Provider not enabled',
    });
  });

  it('survives Supabase throwing rather than returning an error', async () => {
    // GoTrueClient.signInWithIdToken only converts AuthErrors into a returned
    // { error }; anything else — e.g. SecureStore rejecting during the
    // post-exchange _saveSession() — it rethrows. Without its own try/catch
    // that rejection would escape signInWithApple(), breaking the "never
    // throws" contract on the one path every real sign-in takes.
    mockedSignIn.mockResolvedValue({ identityToken: 'jwt-from-apple' });
    mockedIdToken.mockRejectedValue(new Error('Keychain unavailable'));

    expect(await signInWithApple()).toEqual({
      status: 'failed',
      message: 'Keychain unavailable',
    });
  });
});
