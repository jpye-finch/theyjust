import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../lib/supabase';

export type AppleSignInResult =
  | { status: 'signed-in' }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

// The only place in the app that knows Apple exists. Everything downstream —
// the session gate, useSession, the encrypted SecureStore adapter — sees an
// ordinary Supabase session and cannot tell how it was obtained.
//
// A discriminated result rather than throwing: backing out of Apple's sheet is
// a decision, not a failure, and the difference matters at the call site. Left
// as an exception it would surface as "something went wrong" to a parent who
// simply changed their mind.
export async function signInWithApple(): Promise<AppleSignInResult> {
  let identityToken: string | null;
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    identityToken = credential.identityToken;
  } catch (e) {
    if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') {
      return { status: 'cancelled' };
    }
    return { status: 'failed', message: e instanceof Error ? e.message : 'Please try again.' };
  }

  if (!identityToken) {
    return { status: 'failed', message: 'Apple did not return a sign-in token. Please try again.' };
  }

  // No nonce. Supabase requires one only when the token carries a `nonce`
  // claim, and signInAsync omits it unless we pass one in.
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
  });
  if (error) return { status: 'failed', message: error.message };

  return { status: 'signed-in' };
}
