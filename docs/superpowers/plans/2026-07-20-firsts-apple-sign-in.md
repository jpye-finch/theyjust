# Sign in with Apple Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a parent create an account and sign in with one tap on iOS, without ever typing a password or leaving the app for a confirmation email.

**Architecture:** Native-only. `expo-apple-authentication` presents Apple's own sheet and returns an identity token (a JWT); that token goes straight to `supabase.auth.signInWithIdToken({ provider: 'apple', token })`, which mints a normal Supabase session. No browser redirect, no deep link, no Services ID, no `.p8` key — and therefore none of the six-month secret rotation the OAuth flow drags in. The existing session gate, encrypted `SecureStore` adapter and `useSession` hook are untouched: they see an ordinary session and cannot tell how it was obtained.

**Tech Stack:** Expo SDK 57, `expo-apple-authentication`, `@supabase/supabase-js`, jest-expo + RNTL v14.

---

## Before any of this works: two manual steps

Neither can be done from the repo, and **both must be done before Task 5's device test**. Tasks 1–4 can be written and merged without them.

1. **Enable the capability on the App ID.** [developer.apple.com](https://developer.apple.com) → Certificates, Identifiers & Profiles → Identifiers → `com.firsts.app` → tick **Sign in with Apple** → Save. This is why `usesAppleSignIn` was deliberately left out of `app.json` until now: declaring a capability the App ID lacks fails the build.
2. **Enable the provider in Supabase.** Dashboard → Authentication → Providers → **Apple** → enable → put `com.firsts.app` in **Client IDs**. Leave Services ID, Team ID and Key blank: those are the OAuth path only. Supabase's own docs: *"If you're building a native app only, you do not need to configure the OAuth settings."*

Local Supabase needs the same in `supabase/config.toml` for the device test to work against a local stack — covered in Task 5.

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/features/auth/appleSignIn.ts` | **Create.** The whole Apple → Supabase exchange, and the only place that knows Apple exists. Returns a discriminated result so callers never inspect error codes. |
| `src/features/auth/__tests__/appleSignIn.test.ts` | **Create.** Cancellation, missing token, success, Supabase failure. |
| `src/features/auth/AppleSignInButton.tsx` | **Create.** Apple's own button component, gated on platform + availability. Renders nothing where it cannot work. |
| `src/features/auth/__tests__/AppleSignInButton.test.tsx` | **Create.** Renders on iOS when available; renders nothing otherwise. |
| `src/app/(auth)/sign-in.tsx` | **Modify.** Apple button above the email form, with a rule between. |
| `src/app/(auth)/sign-up.tsx` | **Modify.** Same. One tap is the same act either way — Apple creates the account if it does not exist. |
| `app.json` | **Modify.** `ios.usesAppleSignIn: true` + the config plugin. |

**Why `appleSignIn.ts` is separate from the button:** the exchange is logic worth testing on its own, and the button is a system control with almost nothing testable in it. Keeping them apart means the interesting half has real tests and the boring half has two.

---

## Task 1: Install the SDK and declare the capability

**Files:**
- Modify: `package.json` (via `expo install`)
- Modify: `app.json`

- [ ] **Step 1: Install**

```bash
npx expo install expo-apple-authentication
```

- [ ] **Step 2: Declare the capability and the plugin in `app.json`**

Set `usesAppleSignIn` inside the existing `ios` block so it reads exactly:

```json
    "ios": {
      "icon": "./assets/expo.icon",
      "bundleIdentifier": "com.firsts.app",
      "supportsTablet": false,
      "usesAppleSignIn": true
    },
```

And add `"expo-apple-authentication"` to the `plugins` array, after `"expo-secure-store"`:

```json
      "expo-secure-store",
      "expo-apple-authentication"
    ],
```

- [ ] **Step 3: Verify the config is valid**

Run: `npx expo config --type public > /dev/null && echo OK`
Expected: `OK` — and no warning about an unknown plugin.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app.json
git commit -m "feat: add expo-apple-authentication and declare the capability"
```

> **This changes native config, so Metro alone will not pick it up.** The next `npx expo run:ios` will re-run prebuild and rebuild the native project. Task 5 covers that; nothing before then needs a device.

---

## Task 2: The Apple → Supabase exchange

**Files:**
- Create: `src/features/auth/appleSignIn.ts`
- Test: `src/features/auth/__tests__/appleSignIn.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/auth/__tests__/appleSignIn.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- appleSignIn`
Expected: FAIL — `Cannot find module '../appleSignIn'`.

- [ ] **Step 3: Write the implementation**

Create `src/features/auth/appleSignIn.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- appleSignIn`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/appleSignIn.ts src/features/auth/__tests__/appleSignIn.test.ts
git commit -m "feat: exchange an Apple identity token for a Supabase session"
```

---

## Task 3: The button

**Files:**
- Create: `src/features/auth/AppleSignInButton.tsx`
- Test: `src/features/auth/__tests__/AppleSignInButton.test.tsx`

Apple's Human Interface Guidelines govern this button's appearance, wording and proportions. Use `AppleAuthentication.AppleAuthenticationButton` rather than drawing our own — the same reasoning that accepted the system date picker. Only `cornerRadius` is ours, matched to `PrimaryButton`'s `radius.md`.

- [ ] **Step 1: Write the failing test**

Create `src/features/auth/__tests__/AppleSignInButton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AppleSignInButton } from '../AppleSignInButton';

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  AppleAuthenticationButton: 'AppleAuthenticationButton',
  AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1 },
  AppleAuthenticationButtonStyle: { BLACK: 0, WHITE: 1, WHITE_OUTLINE: 2 },
}));

const mockedAvailable = AppleAuthentication.isAvailableAsync as jest.Mock;

afterEach(() => jest.clearAllMocks());

describe('AppleSignInButton', () => {
  it('offers the button where Apple sign-in works', async () => {
    mockedAvailable.mockResolvedValue(true);
    await render(<AppleSignInButton onPress={jest.fn()} />);
    expect(await screen.findByTestId('apple-sign-in')).toBeTruthy();
  });

  it('renders nothing where it does not', async () => {
    // Android, web, and iOS below 13. A dead button that cannot explain itself
    // is worse than no button.
    mockedAvailable.mockResolvedValue(false);
    await render(<AppleSignInButton onPress={jest.fn()} />);
    expect(screen.queryByTestId('apple-sign-in')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- AppleSignInButton`
Expected: FAIL — `Cannot find module '../AppleSignInButton'`.

- [ ] **Step 3: Write the implementation**

Create `src/features/auth/AppleSignInButton.tsx`:

```tsx
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { radius, space } from '@/theme/tokens';

type Props = { onPress: () => void };

// Apple's own button, not ours: its wording, proportions and logo are governed
// by the Human Interface Guidelines, and a hand-drawn imitation is a review
// risk for no gain. Same reasoning that accepted the system date picker — a
// system control is exempt from our chrome rules. cornerRadius is the one part
// we own, matched to PrimaryButton so the two sit together.
//
// Availability is asked rather than assumed: it is false on Android, on web,
// and on iOS below 13. Rendering a button that cannot work and cannot say why
// is worse than rendering nothing.
export function AppleSignInButton({ onPress }: Props) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AppleAuthentication.isAvailableAsync().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!available) return null;

  return (
    <AppleAuthentication.AppleAuthenticationButton
      testID="apple-sign-in"
      // "Continue" rather than "Sign in": one tap both creates the account and
      // returns to it, and the parent should not have to know which is which.
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      // Black on warm paper. WHITE would vanish into the page.
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={radius.md}
      style={styles.button}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  // The native view has no intrinsic height; without one it collapses to zero
  // and the button is invisible with no error to explain it.
  button: { height: 50, marginBottom: space.md },
});
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- AppleSignInButton`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/AppleSignInButton.tsx src/features/auth/__tests__/AppleSignInButton.test.tsx
git commit -m "feat: Apple's sign-in button, hidden where it cannot work"
```

---

## Task 4: Put it on both auth screens

**Files:**
- Modify: `src/app/(auth)/sign-in.tsx`
- Modify: `src/app/(auth)/sign-up.tsx`

Apple goes **above** the email form on both. It is the faster path, Apple's guidelines want it prominent where other options exist, and the form below stays exactly as it is for anyone who prefers a password.

- [ ] **Step 1: Add the button and the rule to `sign-in.tsx`**

Add these imports alongside the existing ones:

```tsx
import { AppleSignInButton } from '@/features/auth/AppleSignInButton';
import { signInWithApple } from '@/features/auth/appleSignIn';
```

Add this handler inside the component, after the existing `signIn`:

```tsx
  const continueWithApple = async () => {
    setBusy(true);
    setError(null);
    const result = await signInWithApple();
    // 'cancelled' says nothing: the parent backed out on purpose and does not
    // need to be told what they just did.
    if (result.status === 'failed') setError(result.message);
    setBusy(false);
    // On success the root layout's auth gate redirects automatically.
  };
```

Replace the single `<AuthForm ... />` line with:

```tsx
      <AppleSignInButton onPress={continueWithApple} />
      <View style={styles.orRow}>
        <View style={styles.orRule} />
        <Text style={styles.orText}>or</Text>
        <View style={styles.orRule} />
      </View>
      <AuthForm submitLabel="Sign in" onSubmit={signIn} error={error} busy={busy} />
```

Add these three styles to the existing `StyleSheet.create` block:

```tsx
  orRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  orRule: { flex: 1, height: 1, backgroundColor: color.rule },
  orText: { fontFamily: font.body, fontSize: type.caption, color: color.inkMuted },
```

- [ ] **Step 2: Do exactly the same in `sign-up.tsx`**

Identical imports, identical `continueWithApple` handler, identical three styles. Place `<AppleSignInButton onPress={continueWithApple} />` and the same `orRow` block immediately above that screen's `<AuthForm ... />`.

One tap creates the account and signs in, so the button needs no different wording here — which is exactly why Task 3 chose `CONTINUE` over `SIGN_IN`.

- [ ] **Step 3: Typecheck and run everything**

```bash
rm -f .expo/types/router.d.ts
npx tsc --noEmit
npm test
```

Expected: tsc exits 0; all suites pass (257 tests — 250 before, 7 added).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(auth)/sign-in.tsx" "src/app/(auth)/sign-up.tsx"
git commit -m "feat: offer Apple above the email form on both auth screens"
```

---

## Task 5: Prove it on a device

Tasks 1–4 are testable without a device. **This one is not, and nothing here is finished until it passes.** Every defect found on this project in the last week was invisible to both tsc and the full test suite.

**The two manual steps at the top of this plan must be done before starting.**

- [ ] **Step 1: Point local Supabase at the same provider**

Add to `supabase/config.toml`:

```toml
[auth.external.apple]
enabled = true
client_id = "com.firsts.app"
```

Then `npx supabase stop && npx supabase start`.

**Do not change `project_id` in that file** — it names the Docker volumes, and changing it strands the local database.

- [ ] **Step 2: Rebuild natively**

`usesAppleSignIn` is a native capability. Metro cannot deliver it.

```bash
rm -rf ios
npx expo run:ios --device <a booted iPhone simulator UDID>
```

Expected: the app builds, installs and launches. Verify with `xcrun simctl listapps <udid> | grep -c com.firsts.app` → `1`. **Do not trust the exit code** — `expo run:ios` has returned 0 on runs that produced no binary.

- [ ] **Step 3: Walk the four paths on the device**

- [ ] **Continue with Apple as a new user** → Apple's sheet appears → authenticate → lands on the Timeline empty state, inviting a first child. (A brand-new user needs no family: `ensureFamilyId()` is idempotent and runs lazily when the first child is added.)
- [ ] **Add a child, then sign out and Continue with Apple again** → the same family and child come back. This is the one that proves the account is stable rather than minting a new user each time.
- [ ] **Cancel the Apple sheet** → returns to the sign-in screen with **no error message showing**.
- [ ] **Email and password still work** → sign in with an existing email account, unchanged.

- [ ] **Step 4: Confirm the session is stored encrypted**

The Apple path must land in the same encrypted `SecureStore` slot as the email path, not a plaintext fallback:

```bash
xcrun simctl spawn <udid> log show --last 2m --predicate 'process == "Firsts"' 2>/dev/null | grep -i "securestore\|session" | head
```

Then confirm in-app that a force-quit and relaunch keeps you signed in.

- [ ] **Step 5: If Supabase rejects the token with a nonce error**

The one uncertainty in this plan. Supabase requires a nonce **only** if the identity token carries a `nonce` claim, and `signInAsync` omits it unless asked — so the expected path is no nonce at all. If a `nonce` error does appear, generate one with `expo-crypto`, pass its SHA-256 hash to `signInAsync({ nonce })`, and pass the **raw** value to `signInWithIdToken({ nonce })`. Hash to Apple, raw to Supabase — reversing them fails with the same unhelpful message.

- [ ] **Step 6: Commit and push**

```bash
git add supabase/config.toml
git commit -m "chore: enable the Apple provider on the local stack"
git push origin main
```

---

## Self-review

**Coverage.** Install and capability (1), the token exchange (2), the button (3), both screens (4), device proof (5). The two things an agent cannot do — the App ID capability and the Supabase provider — are called out at the top and again as Task 5's precondition.

**Naming, checked across tasks.** `signInWithApple()` returns `AppleSignInResult` with `status: 'signed-in' | 'cancelled' | 'failed'`; Task 4 branches only on `'failed'`. The button's prop is `onPress`, and its testID `apple-sign-in` is the same string in both the component and its test. Supabase's parameter is `token` — **not** `idToken`, which is what the Swift and Flutter docs show; verified against `SignInWithIdTokenCredentials` in the installed `@supabase/auth-js` types.

**Deliberately not here.** Google sign-in: adding it would oblige Sign in with Apple under App Store guideline 4.8, and it adds little to an iOS-first launch. Apple alone triggers no such obligation. Apple's `fullName` is requested but discarded — it arrives only on the very first authentication, and the app asks for the *child's* name, never the parent's. Storing a name nothing displays would be collecting data for its own sake.

**Still not shippable after this.** The app icon remains the only true submission blocker.
