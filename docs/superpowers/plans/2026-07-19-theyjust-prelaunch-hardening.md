# Pre-launch Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four things standing between TheyJust and a store submission: a session stored in plaintext, a sign-up screen that breaks the moment email confirmation is switched on, development-only auth configuration, and no Apple or Google sign-in.

**Architecture:** The session is encrypted with AES-CTR using a 256-bit key held in the device keychain (expo-secure-store), while the ciphertext lives in AsyncStorage — SecureStore alone cannot hold a session, as it caps values at 2048 bytes. OAuth uses native identity tokens (`signInWithIdToken`) rather than a web redirect, so the flow never leaves the app. Web keeps plain AsyncStorage throughout, because SecureStore has no web implementation and web is a development surface, not a shipping target.

**Tech Stack:** Expo SDK 57, expo-secure-store, expo-crypto, aes-js, expo-apple-authentication, @react-native-google-signin/google-signin, Supabase Auth, jest-expo + RNTL v14.

---

## Read this before starting: the plan is in two halves

**Part A (Tasks 1–4) is not blocked by anything.** It can be built, tested and merged today.

**Part B (Tasks 5–8) is blocked on an Apple Developer account**, which does not exist yet and takes time to approve (individual enrolment is usually 24–48 hours, but can take longer if identity checks are involved). Nothing in Part B can be completed without it:

- A bundle identifier must be registered against a real team before Sign in with Apple can be enabled.
- Sign in with Apple requires a Services ID, a key, and a team ID from the developer portal.
- Google sign-in on iOS still requires the app to ship Sign in with Apple, because **offering any third-party sign-in makes Apple sign-in mandatory under App Store Review Guideline 4.8**. So Google cannot ship first as a way of working around the block.

**Therefore: do Part A first and merge it.** Do not start Part B until the account exists. If you reach Task 5 and the account is not ready, stop and say so — do not invent placeholder identifiers, because a bundle identifier is painful to change once it has shipped.

## Scope

**In:** encrypted session persistence, the sign-up "check your email" state, production auth configuration, app identity, and both OAuth providers.

**Out:** Sentry crash reporting (spec §6 names it, but it is telemetry rather than a launch blocker, and it wants its own PII-scrubbing decisions). Offline mutation queueing (spec §7) — the app is already browsable from cache, and queuing writes is a feature, not hardening. Passkeys, phone auth, and captcha.

## Context an implementer needs

- `npm test` pins `TZ=America/Los_Angeles`; a bare `npx jest` uses the host zone. Always use `npm test`.
- Local `tsc` needs `rm -f .expo/types/router.d.ts` first — the generated typed-routes file goes stale and CI never generates it. `tsconfig.json` already excludes `supabase/functions` (Deno, not part of the app's TS project).
- Never run `npm run lint`: the project has no eslint config, and Expo's lint command scaffolds one and installs dependencies, contaminating the tree.
- `Alert.alert` is a **no-op on react-native-web**. Use `notify` / `confirmDestructive` from `src/lib/dialog.ts`.
- Imports: `@/` for `@/components`, `@/features`, `@/lib`, `@/theme` inside `src/app`; relative inside `src/features`.
- DESIGN.md: Fraunces is the celebration voice **only**; Karla does all functional work. No cards, no pills.
- Install Expo packages with `npx expo install <pkg>`, never bare `npm install` — it picks the version matched to SDK 57.
- **expo-secure-store is native code.** It does not exist in Expo Go. Anything in Task 1–2 can only be verified on a development build (`npx expo run:ios`) or on web (where it is bypassed). Plan accordingly and do not claim native verification you did not do.
- Local mail (Inbucket) is at **http://127.0.0.1:54324** — that is where confirmation emails land in development.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/sessionStorage.ts` | encrypted AsyncStorage adapter for the Supabase session |
| `src/lib/__tests__/sessionStorage.test.ts` | round-trip, ciphertext-at-rest, legacy migration |
| `src/lib/supabase.ts` | use the adapter; add PKCE + web-only `detectSessionInUrl` |
| `src/app/(auth)/sign-up.tsx` | "check your email" state when no session comes back |
| `src/features/auth/__tests__/signUp.test.tsx` | asserts the pending state |
| `supabase/config.toml` | `enable_confirmations`, `site_url`, redirect URLs, SMTP, providers |
| `app.json` | bundle identifier, Android package, auth plugins |
| `src/features/auth/socialAuth.ts` | Apple + Google native sign-in |
| `src/features/auth/__tests__/socialAuth.test.ts` | unit tests for the above |
| `src/features/auth/SocialButtons.tsx` | the two provider buttons |
| `docs/RELEASE.md` | the production checklist that cannot live in code |

---

# Part A — ships today

### Task 1: Encrypted session storage (TDD)

The Supabase session currently sits in AsyncStorage as plaintext JSON, which on a rooted or jailbroken device — or any device backup — hands over a working access and refresh token. The fix is Supabase's documented React Native pattern: keep a 256-bit AES key in the OS keychain and the encrypted session in AsyncStorage. The key is small enough for SecureStore's 2048-byte limit; the session is not.

**Files:**
- Create: `src/lib/sessionStorage.ts`
- Test: `src/lib/__tests__/sessionStorage.test.ts`

- [ ] **Step 1: Install the three dependencies**

```bash
npx expo install expo-secure-store expo-crypto
npm install aes-js
npm install --save-dev @types/aes-js
```

`aes-js` is pure JavaScript (no native module), so it works on iOS, Android and web unchanged.

- [ ] **Step 2: Write the failing tests**

Create `src/lib/__tests__/sessionStorage.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { sessionStorage } from '../sessionStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Deterministic key material: the real one is random, which would make the
// ciphertext assertions unreproducible.
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => new Uint8Array(n).fill(7),
}));

const mockedAsync = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockedSecure = SecureStore as jest.Mocked<typeof SecureStore>;

// A stand-in for the real keychain, so a set in one call is visible to the next.
function secureStoreBackedByMemory() {
  const store = new Map<string, string>();
  mockedSecure.getItemAsync.mockImplementation(async (k) => store.get(k) ?? null);
  mockedSecure.setItemAsync.mockImplementation(async (k, v) => {
    store.set(k, v);
  });
  mockedSecure.deleteItemAsync.mockImplementation(async (k) => {
    store.delete(k);
  });
  return store;
}

beforeEach(() => {
  jest.clearAllMocks();
  secureStoreBackedByMemory();
});

describe('sessionStorage', () => {
  it('round-trips a value through encryption', async () => {
    let stored: string | null = null;
    mockedAsync.setItem.mockImplementation(async (_k, v) => {
      stored = v;
    });
    mockedAsync.getItem.mockImplementation(async () => stored);

    await sessionStorage.setItem('sb-session', '{"access_token":"abc123"}');
    const out = await sessionStorage.getItem('sb-session');

    expect(out).toBe('{"access_token":"abc123"}');
  });

  it('writes ciphertext, never the token itself', async () => {
    let stored = '';
    mockedAsync.setItem.mockImplementation(async (_k, v) => {
      stored = v;
    });

    await sessionStorage.setItem('sb-session', '{"access_token":"abc123"}');

    // This is the whole point of the task: a device backup must not contain the token.
    expect(stored).not.toContain('abc123');
    expect(stored).not.toContain('access_token');
    expect(stored).toMatch(/^[0-9a-f]+$/);
  });

  it('keeps the encryption key out of AsyncStorage', async () => {
    mockedAsync.setItem.mockResolvedValue(undefined);
    await sessionStorage.setItem('sb-session', '{"access_token":"abc123"}');

    // The key belongs in the keychain; storing it beside the ciphertext would
    // make the encryption decorative.
    const asyncKeys = mockedAsync.setItem.mock.calls.map(([k]) => k);
    expect(asyncKeys).toEqual(['sb-session']);
    expect(mockedSecure.setItemAsync).toHaveBeenCalledWith(
      'sb-session-key',
      expect.any(String),
    );
  });

  it('reads a legacy plaintext session and re-encrypts it', async () => {
    // Anyone who used the app before this task has a plaintext session already.
    // Failing to read it would sign them out on upgrade for no reason.
    let stored: string | null = '{"access_token":"legacy"}';
    mockedAsync.getItem.mockImplementation(async () => stored);
    mockedAsync.setItem.mockImplementation(async (_k, v) => {
      stored = v;
    });

    const out = await sessionStorage.getItem('sb-session');

    expect(out).toBe('{"access_token":"legacy"}');
    expect(stored).not.toContain('legacy');
  });

  it('returns null when nothing is stored', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    expect(await sessionStorage.getItem('sb-session')).toBeNull();
  });

  it('clears the ciphertext and the key together on sign-out', async () => {
    mockedAsync.removeItem.mockResolvedValue(undefined);
    await sessionStorage.removeItem('sb-session');

    expect(mockedAsync.removeItem).toHaveBeenCalledWith('sb-session');
    // Leaving an orphan key behind would decrypt the NEXT user's session slot.
    expect(mockedSecure.deleteItemAsync).toHaveBeenCalledWith('sb-session-key');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
npm test -- sessionStorage
```

Expected: FAIL, `Cannot find module '../sessionStorage'`.

- [ ] **Step 4: Implement `src/lib/sessionStorage.ts`**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import aesjs from 'aes-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// The Supabase session is a working access + refresh token pair, and AsyncStorage
// is plaintext on disk. SecureStore is the right home for secrets but caps values
// at 2048 bytes, which a session exceeds — so the 256-bit AES key lives in the
// keychain and the encrypted session lives in AsyncStorage. This is Supabase's
// documented React Native pattern.
//
// Web has no SecureStore implementation, and web is a development surface rather
// than a shipping target, so it passes straight through to AsyncStorage.

const keyNameFor = (key: string) => `${key}-key`;

async function encryptionKey(key: string): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(keyNameFor(key));
  if (existing) return aesjs.utils.hex.toBytes(existing);

  const fresh = Crypto.getRandomBytes(32);
  await SecureStore.setItemAsync(keyNameFor(key), aesjs.utils.hex.fromBytes(fresh));
  return fresh;
}

async function encrypt(key: string, value: string): Promise<string> {
  const cipher = new aesjs.ModeOfOperation.ctr(await encryptionKey(key), new aesjs.Counter(1));
  return aesjs.utils.hex.fromBytes(cipher.encrypt(aesjs.utils.utf8.toBytes(value)));
}

function decrypt(keyBytes: Uint8Array, hex: string): string {
  const cipher = new aesjs.ModeOfOperation.ctr(keyBytes, new aesjs.Counter(1));
  return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(hex)));
}

export const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const stored = await AsyncStorage.getItem(key);
    if (stored === null) return null;
    if (Platform.OS === 'web') return stored;

    const keyHex = await SecureStore.getItemAsync(keyNameFor(key));
    // No key but a value present means this was written before the app started
    // encrypting. Read it, then immediately re-encrypt so the plaintext copy is
    // replaced rather than tolerated. AES-CTR on the wrong bytes yields garbage
    // rather than throwing, so "is there a key?" is the only sound test.
    if (!keyHex) {
      await this.setItem(key, stored);
      return stored;
    }
    return decrypt(aesjs.utils.hex.toBytes(keyHex), stored);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, await encrypt(key, value));
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    // The key must go with it: a stale key against a fresh session slot decrypts
    // to garbage, which reads as a corrupt session rather than a signed-out one.
    if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(keyNameFor(key));
  },
};
```

- [ ] **Step 5: Run to verify they pass**

```bash
npm test -- sessionStorage
rm -f .expo/types/router.d.ts && npx tsc --noEmit
```

Expected: 6 passed; tsc exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sessionStorage.ts src/lib/__tests__/sessionStorage.test.ts package.json package-lock.json
git commit -m "feat: encrypt the persisted session — AES key in the keychain, ciphertext in AsyncStorage"
```

---

### Task 2: Use the adapter, and configure the client for OAuth

Two changes in one file. The adapter swap is the point; the PKCE and `detectSessionInUrl` settings are what Task 6 and 7 will need, and setting them now means the OAuth tasks touch only their own files.

**Files:**
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Replace the storage and auth options.** Change:

```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
```

to:

```ts
import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { sessionStorage } from './sessionStorage';
```

and change:

```ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

to:

```ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Only the web build ever receives a session in the URL. On native the OAuth
    // providers hand back an identity token directly, and leaving this on would
    // make the client parse every deep link looking for auth fragments.
    detectSessionInUrl: Platform.OS === 'web',
    // PKCE is required for the OAuth flows added in Tasks 6 and 7, and is the
    // recommended flow for public clients generally.
    flowType: 'pkce',
  },
});
```

- [ ] **Step 2: Verify**

```bash
rm -f .expo/types/router.d.ts
npx tsc --noEmit && npm test
```

Expected: tsc exit 0; full suite green (152 tests plus Task 1's 6).

- [ ] **Step 3: Verify the app still signs in on web**

Start the dev server, sign in, and confirm the timeline loads. On web the adapter passes through to AsyncStorage, so this proves the client wiring rather than the encryption.

- [ ] **Step 4: Verify encryption on a real device.** This is the only step that proves the task. In a development build (`npx expo run:ios`), sign in, then confirm the stored session is unreadable:

```bash
xcrun simctl get_app_container booted <bundle-id> data
```

Inspect the AsyncStorage manifest under that container: the value against the Supabase session key must be hex, and must not contain `access_token`. If you cannot produce a development build yet (Task 5 registers the bundle identifier), say so plainly and leave this step unchecked rather than marking the task verified.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: persist the session through the encrypted adapter; PKCE + web-only URL detection"
```

---

### Task 3: A sign-up screen that survives email confirmation (TDD)

`sign-up.tsx` assumes `signUp` returns a session and the auth gate redirects. That is only true because local development has confirmations disabled. The moment Task 4 turns them on, a new parent taps Sign up, gets no session, no error and no redirect — the screen simply sits there. Handle the pending case before flipping the switch.

**Files:**
- Modify: `src/app/(auth)/sign-up.tsx`
- Test: `src/features/auth/__tests__/signUp.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/auth/__tests__/signUp.test.tsx`:

```tsx
import { render, screen, userEvent } from '@testing-library/react-native';
import SignUp from '../../../app/(auth)/sign-up';
import { supabase } from '../../../lib/supabase';

jest.mock('../../../lib/supabase', () => ({
  supabase: { auth: { signUp: jest.fn() } },
}));

const mockedSignUp = supabase.auth.signUp as jest.Mock;

afterEach(() => jest.clearAllMocks());

async function submit() {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('Email'), 'parent@test.local');
  await user.type(screen.getByPlaceholderText('Password'), 'hunter2hunter2');
  await user.press(screen.getByText('Sign up'));
}

describe('SignUp', () => {
  it('asks the parent to check their email when no session comes back', async () => {
    // Supabase returns a user but a null session when confirmations are on.
    mockedSignUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: null },
      error: null,
    });
    await render(<SignUp />);
    await submit();

    expect(await screen.findByText('Check your email')).toBeTruthy();
    expect(
      screen.getByText('We sent a confirmation link to parent@test.local. Tap it and you are in.'),
    ).toBeTruthy();
    // The form is done: leaving it on screen invites a confused second sign-up.
    expect(screen.queryByPlaceholderText('Password')).toBeNull();
  });

  it('stays quiet when a session comes back, letting the auth gate redirect', async () => {
    mockedSignUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 'a' } },
      error: null,
    });
    await render(<SignUp />);
    await submit();

    expect(screen.queryByText('Check your email')).toBeNull();
  });

  it('shows the error and keeps the form when sign-up fails', async () => {
    mockedSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    });
    await render(<SignUp />);
    await submit();

    expect(await screen.findByText('User already registered')).toBeTruthy();
    // A failure must NOT read as "check your email" — that would send the parent
    // hunting for an email that was never sent.
    expect(screen.queryByText('Check your email')).toBeNull();
    expect(screen.getByPlaceholderText('Password')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- signUp
```

Expected: FAIL, `Unable to find an element with text: Check your email`.

- [ ] **Step 3: Implement the pending state.** Replace the whole of `src/app/(auth)/sign-up.tsx` with:

```tsx
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthForm } from '@/features/auth/AuthForm';
import { supabase } from '@/lib/supabase';
import { color, font, space, type } from '@/theme/tokens';

export default function SignUp() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const signUp = async (email: string, password: string) => {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    // With email confirmation on, Supabase returns a user but no session. There
    // is nothing for the auth gate to redirect on, so the screen has to say so
    // itself — otherwise Sign up looks like it silently did nothing.
    if (!data.session) setPendingEmail(email);
  };

  if (pendingEmail) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.blurb}>
          {`We sent a confirmation link to ${pendingEmail}. Tap it and you are in.`}
        </Text>
        <Link href="/(auth)/sign-in" style={styles.link}>
          Back to sign in
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Create account</Text>
      <AuthForm submitLabel="Sign up" onSubmit={signUp} error={error} busy={busy} />
      <Link href="/(auth)/sign-in" style={styles.link}>
        Already have an account? Sign in
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: space.xl,
    gap: space.xl,
    backgroundColor: color.paper,
  },
  title: {
    fontFamily: font.display,
    fontSize: type.hero,
    color: color.ink,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  blurb: {
    fontFamily: font.body,
    fontSize: type.body,
    color: color.inkMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  link: {
    fontFamily: font.medium,
    fontSize: type.label,
    textAlign: 'center',
    marginTop: space.sm,
    color: color.inkMuted,
  },
});
```

- [ ] **Step 4: Run to verify they pass**

```bash
npm test -- signUp && rm -f .expo/types/router.d.ts && npx tsc --noEmit
```

Expected: 3 passed; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)/sign-up.tsx" src/features/auth/__tests__/signUp.test.tsx
git commit -m "feat: sign-up tells the parent to check their email when confirmation is required"
```

---

### Task 4: Turn email confirmation on locally and prove the flow

Only the `[auth.email]` block changes. **Do not touch the `enable_confirmations` under `[auth.sms]`** (around line 261) — SMS auth is disabled and unused, and flipping it would enable a confirmation step for a channel that sends nothing.

**Files:**
- Modify: `supabase/config.toml`

- [ ] **Step 1: Require email confirmation.** In the `[auth.email]` block (around line 226), change:

```toml
# If enabled, users need to confirm their email address before signing in.
enable_confirmations = false
```

to:

```toml
# If enabled, users need to confirm their email address before signing in.
enable_confirmations = true
```

- [ ] **Step 2: Restart Supabase so the change is picked up**

```bash
npx supabase stop && npx supabase start
```

- [ ] **Step 3: Prove the whole loop by hand.** Sign up as a new address in the app. Expected: the screen shows "Check your email", and no session is created. Open **http://127.0.0.1:54324**, find the message, click the confirmation link, then sign in. Expected: sign-in now succeeds. Confirm in SQL that the confirmation actually landed:

```bash
docker exec supabase_db_theyjust psql -U postgres -At -c \
  "select email, email_confirmed_at is not null from auth.users order by created_at desc limit 3;"
```

Expected: the new address shows `t`. An unconfirmed address showing `t` would mean confirmation is not really enforced.

- [ ] **Step 4: Full gates**

```bash
rm -f .expo/types/router.d.ts
npx tsc --noEmit && npm test && npx supabase test db
```

Expected: tsc exit 0; Jest green; pgTAP 52 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml
git commit -m "feat(auth): require email confirmation, matching production"
```

**Part A is complete. Merge and push it. Do not continue past this line until the Apple Developer account exists.**

---

# Part B — blocked on the Apple Developer account

### Task 5: App identity

`app.json` has no `ios.bundleIdentifier` and no `android.package`. Both are required to build natively, to register an App ID with Apple, and to submit to either store. A bundle identifier is effectively permanent once shipped — an app cannot change it without becoming a different app and losing its users — so this must not be guessed.

**Files:**
- Modify: `app.json`

- [ ] **Step 1: Confirm the identifier with the account holder before writing it.** The convention is reverse-DNS on a domain you control: `com.theyjust.app` if `theyjust.com` is registered, otherwise `uk.co.pyefinch.theyjust`. Ask; do not choose unilaterally.

- [ ] **Step 2: Add the identifiers.** In `app.json`, change:

```json
    "ios": {
      "icon": "./assets/expo.icon"
    },
```

to (substituting the confirmed identifier):

```json
    "ios": {
      "icon": "./assets/expo.icon",
      "bundleIdentifier": "com.theyjust.app",
      "supportsTablet": false,
      "usesAppleSignIn": true
    },
```

and in the `android` block, add the package key alongside the existing `adaptiveIcon`:

```json
      "package": "com.theyjust.app",
```

- [ ] **Step 3: Verify the config resolves**

```bash
npx expo config --type public > /dev/null && echo "config OK"
```

Expected: `config OK`.

- [ ] **Step 4: Commit**

```bash
git add app.json
git commit -m "chore: register the bundle identifier and Android package"
```

---

### Task 6: Sign in with Apple

Native Apple sign-in returns an identity token that goes straight to `signInWithIdToken`, so the parent never leaves the app.

**Files:**
- Create: `src/features/auth/socialAuth.ts`
- Test: `src/features/auth/__tests__/socialAuth.test.ts`
- Modify: `app.json`, `supabase/config.toml`

- [ ] **Step 1: Install and register the plugin**

```bash
npx expo install expo-apple-authentication
```

Add `"expo-apple-authentication"` to the `plugins` array in `app.json`.

- [ ] **Step 2: Write the failing tests**

Create `src/features/auth/__tests__/socialAuth.test.ts`:

```ts
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../../lib/supabase';
import { signInWithApple } from '../socialAuth';

jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('../../../lib/supabase', () => ({
  supabase: { auth: { signInWithIdToken: jest.fn() } },
}));

const mockedApple = AppleAuthentication.signInAsync as jest.Mock;
const mockedIdToken = supabase.auth.signInWithIdToken as jest.Mock;

afterEach(() => jest.clearAllMocks());

describe('signInWithApple', () => {
  it('exchanges Apple\'s identity token for a Supabase session', async () => {
    mockedApple.mockResolvedValue({ identityToken: 'apple-token' });
    mockedIdToken.mockResolvedValue({ data: { session: {} }, error: null });

    await signInWithApple();

    expect(mockedIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'apple-token',
    });
  });

  it('returns quietly when the parent cancels', async () => {
    // Apple throws ERR_REQUEST_CANCELED when the sheet is dismissed. That is not
    // an error worth showing anyone.
    mockedApple.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });

    await expect(signInWithApple()).resolves.toBeUndefined();
    expect(mockedIdToken).not.toHaveBeenCalled();
  });

  it('throws when Apple returns no identity token', async () => {
    mockedApple.mockResolvedValue({ identityToken: null });

    await expect(signInWithApple()).rejects.toThrow('No identity token from Apple');
    expect(mockedIdToken).not.toHaveBeenCalled();
  });

  it('surfaces a Supabase failure', async () => {
    mockedApple.mockResolvedValue({ identityToken: 'apple-token' });
    mockedIdToken.mockResolvedValue({ data: null, error: { message: 'bad token' } });

    await expect(signInWithApple()).rejects.toThrow('bad token');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
npm test -- socialAuth
```

Expected: FAIL, `Cannot find module '../socialAuth'`.

- [ ] **Step 4: Implement `src/features/auth/socialAuth.ts`**

```ts
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../lib/supabase';

// Native provider sign-in: the provider hands back an identity token and we trade
// it for a Supabase session, so the parent never leaves the app for a browser.
export async function signInWithApple(): Promise<void> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e) {
    // Dismissing the sheet is a decision, not a fault: swallow it so the screen
    // does not accuse the parent of an error they did not cause.
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
    throw e;
  }

  if (!credential.identityToken) throw new Error('No identity token from Apple');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 5: Run to verify they pass**

```bash
npm test -- socialAuth && rm -f .expo/types/router.d.ts && npx tsc --noEmit
```

Expected: 4 passed; tsc exit 0.

- [ ] **Step 6: Enable the provider locally.** In `supabase/config.toml`, in the existing `[auth.external.apple]` block (around line 322), change `enabled = false` to `enabled = true` and set `client_id` to the bundle identifier from Task 5. Leave the `secret` line using environment substitution — **never commit the secret**. Restart with `npx supabase stop && npx supabase start`.

- [ ] **Step 7: Commit**

```bash
git add src/features/auth/socialAuth.ts src/features/auth/__tests__/socialAuth.test.ts app.json supabase/config.toml package.json package-lock.json
git commit -m "feat(auth): Sign in with Apple via native identity token"
```

---

### Task 7: Sign in with Google, and the provider buttons

**Files:**
- Modify: `src/features/auth/socialAuth.ts`, `src/features/auth/__tests__/socialAuth.test.ts`
- Create: `src/features/auth/SocialButtons.tsx`
- Modify: `src/app/(auth)/sign-in.tsx`

- [ ] **Step 1: Install**

```bash
npx expo install @react-native-google-signin/google-signin
```

Add `"@react-native-google-signin/google-signin"` to the `plugins` array in `app.json`.

- [ ] **Step 2: Add the failing Google tests.** Append to `src/features/auth/__tests__/socialAuth.test.ts`, and add the mock beside the existing ones at the top of the file:

```ts
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
}));
```

```ts
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { signInWithGoogle } from '../socialAuth';

const mockedGoogle = GoogleSignin.signIn as jest.Mock;

describe('signInWithGoogle', () => {
  it('exchanges Google\'s id token for a Supabase session', async () => {
    mockedGoogle.mockResolvedValue({ data: { idToken: 'google-token' } });
    mockedIdToken.mockResolvedValue({ data: { session: {} }, error: null });

    await signInWithGoogle();

    expect(mockedIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'google-token',
    });
  });

  it('returns quietly when the parent cancels', async () => {
    mockedGoogle.mockRejectedValue({ code: 'SIGN_IN_CANCELLED' });

    await expect(signInWithGoogle()).resolves.toBeUndefined();
    expect(mockedIdToken).not.toHaveBeenCalled();
  });

  it('throws when Google returns no id token', async () => {
    mockedGoogle.mockResolvedValue({ data: { idToken: null } });

    await expect(signInWithGoogle()).rejects.toThrow('No identity token from Google');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
npm test -- socialAuth
```

Expected: FAIL, `signInWithGoogle is not a function`.

- [ ] **Step 4: Append the implementation to `src/features/auth/socialAuth.ts`**

```ts
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

export async function signInWithGoogle(): Promise<void> {
  let idToken: string | null;
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    idToken = response.data?.idToken ?? null;
  } catch (e) {
    if ((e as { code?: string }).code === statusCodes.SIGN_IN_CANCELLED) return;
    throw e;
  }

  if (!idToken) throw new Error('No identity token from Google');

  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 5: Build the buttons.** Create `src/features/auth/SocialButtons.tsx`:

```tsx
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { notify } from '@/lib/dialog';
import { color, font, radius, space, type } from '@/theme/tokens';
import { signInWithApple, signInWithGoogle } from './socialAuth';

// Apple's button is drawn by Apple: its shape, wording and contrast are dictated
// by the Human Interface Guidelines, and a hand-rolled copy fails review.
export function SocialButtons() {
  const run = (fn: () => Promise<void>) => () => {
    fn().catch((e) =>
      notify('Could not sign in', e instanceof Error ? e.message : 'Please try again.'),
    );
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'ios' ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={radius.md}
          style={styles.apple}
          onPress={run(signInWithApple)}
        />
      ) : null}
      <Pressable style={styles.google} onPress={run(signInWithGoogle)} accessibilityRole="button">
        <Text style={styles.googleText}>Continue with Google</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.md },
  apple: { height: 48, width: '100%' },
  google: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleText: { fontFamily: font.medium, fontSize: type.label, color: color.ink },
});
```

- [ ] **Step 6: Put them on the sign-in screen.** In `src/app/(auth)/sign-in.tsx`, add the import:

```tsx
import { SocialButtons } from '@/features/auth/SocialButtons';
```

and render `<SocialButtons />` directly beneath the `<AuthForm ... />` element.

- [ ] **Step 7: Configure the provider.** In `supabase/config.toml`, add beneath the existing `[auth.external.apple]` block:

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
# Local sign-in with Google cannot complete the nonce check.
skip_nonce_check = true
```

- [ ] **Step 8: Verify**

```bash
npm test -- socialAuth && rm -f .expo/types/router.d.ts && npx tsc --noEmit && npm test
```

Expected: 7 socialAuth tests pass; tsc exit 0; full suite green.

- [ ] **Step 9: Device check.** Neither provider can be exercised on web or in Expo Go — both need a development build on a real device or simulator signed with the team from Task 5. Confirm: the Apple button appears on iOS only; tapping it opens Apple's sheet; completing it lands on the Timeline; cancelling it returns silently with no error dialog; a row appears in `auth.users` with the matching provider. Repeat for Google.

- [ ] **Step 10: Commit**

```bash
git add src/features/auth/socialAuth.ts src/features/auth/__tests__/socialAuth.test.ts src/features/auth/SocialButtons.tsx "src/app/(auth)/sign-in.tsx" app.json supabase/config.toml package.json package-lock.json
git commit -m "feat(auth): Sign in with Google, and the provider buttons"
```

---

### Task 8: Production configuration and the release checklist

Most of this cannot live in the repository: it is dashboard configuration against the hosted project. Write it down so it is repeatable rather than remembered.

**Files:**
- Create: `docs/RELEASE.md`
- Modify: `supabase/config.toml`

- [ ] **Step 1: Point the local config at real URLs.** In `supabase/config.toml`, change:

```toml
site_url = "http://127.0.0.1:3000"
additional_redirect_urls = ["https://127.0.0.1:3000"]
```

to (substituting the real domain once registered):

```toml
site_url = "https://theyjust.com"
additional_redirect_urls = ["https://theyjust.com", "theyjust://"]
```

The `theyjust://` entry is the app's own scheme, already set in `app.json`; without it a confirmation link cannot hand control back to the installed app.

- [ ] **Step 2: Write `docs/RELEASE.md`**

```markdown
# Release checklist

Everything here is configured against the hosted Supabase project and the two
developer accounts. None of it is exercised by CI, so it is checked by hand
before each store submission.

## Supabase (production project)

- [ ] Region is in the EU (spec §6 — the data is about children).
- [ ] `enable_confirmations` is on for email.
- [ ] `site_url` is `https://theyjust.com`; redirect URLs include `theyjust://`.
- [ ] A real SMTP provider is configured. The local Inbucket mailbox does not
      exist in production, so without this **no confirmation email is ever sent**
      and every new sign-up is stranded.
- [ ] Rate limits reviewed: the default of 2 confirmation emails per hour is a
      development default and will lock out real sign-ups.
- [ ] Apple and Google providers enabled, with secrets set as environment
      variables — never committed.
- [ ] The `delete-account` Edge Function is deployed:
      `npx supabase functions deploy delete-account`.
- [ ] Storage bucket `moment-photos` is private, and its RLS policies match the
      migrations.

## Apple

- [ ] Developer account active.
- [ ] App ID registered for the bundle identifier, with Sign in with Apple enabled.
- [ ] Services ID, key and team ID recorded in the Supabase Apple provider.
- [ ] Privacy policy URL live (required for submission, and for GDPR).
- [ ] App Privacy answers completed: data collected is the child's first name,
      date of birth, optional due date, and photos. No tracking, no analytics SDKs.
- [ ] Account deletion is reachable in-app (Family → Delete my account). Apple
      rejects apps that create accounts without offering deletion.

## Google

- [ ] OAuth client IDs created for iOS and Android (Android needs the release
      keystore's SHA-1 fingerprint).

## Build

- [ ] `npx expo export --platform web` exits 0.
- [ ] `npx tsc --noEmit` exits 0 and `npm test` is green.
- [ ] `npx supabase test db` passes.
- [ ] Manual device pass on iOS and Android (spec §8): sign in, capture a moment
      with photos, edit it, share it, export the data, delete the account.
```

- [ ] **Step 3: Full gates**

```bash
rm -f .expo/types/router.d.ts
npx tsc --noEmit && npm test && npx supabase test db
npx expo export --platform web > /dev/null 2>&1 && echo "export OK" && rm -rf dist
```

Expected: tsc exit 0; Jest green; pgTAP 52 assertions; `export OK`.

- [ ] **Step 4: Commit**

```bash
git add docs/RELEASE.md supabase/config.toml
git commit -m "docs: release checklist; point auth config at the real domain"
```

---

## Self-review

**Spec coverage.** §6 session token storage — Tasks 1 and 2 implement exactly the named approach (AES key in expo-secure-store, encrypted blob in AsyncStorage). §9 pre-launch checklist, item 1 — Tasks 1–2. Item 2 (`enable_confirmations`, the "check your email" pending state, real `site_url`, production SMTP) — Tasks 3, 4 and 8. Item 3 (OAuth needs `detectSessionInUrl` on web and PKCE) — Task 2, with the providers themselves in Tasks 6–7. §8's manual device pass is carried into `docs/RELEASE.md`.

**Known gap, deliberate:** §6 also names Sentry crash reporting with PII scrubbing. It is out of scope here and has no task — it is telemetry rather than a launch blocker, and choosing what to scrub deserves its own decision. If it is wanted for v1, it needs a task added.

**Placeholder scan.** No TBDs. Two values are intentionally left to the account holder rather than invented: the bundle identifier (Task 5 Step 1) and the production domain (Task 8 Step 1). Both are flagged as "ask, do not choose", because a bundle identifier cannot be changed after shipping. Every code step carries its full code.

**Type consistency.** `sessionStorage` exposes `getItem`/`setItem`/`removeItem`, matching the shape `createClient`'s `auth.storage` option expects, and is consumed under that name in Task 2. `signInWithApple()` and `signInWithGoogle()` are defined in Tasks 6 and 7 and consumed by `SocialButtons` in Task 7. `notify` matches `src/lib/dialog.ts`. Token tokens (`color`, `font`, `radius`, `space`, `type`) all exist in `src/theme/tokens.ts`; `radius.md` is 10, used for the Apple button's corner radius.

**Ordering risk.** Task 2 Step 4 asks for a device check that needs the bundle identifier from Task 5, which is in the blocked half. That is called out in the step itself: leave it unchecked rather than claiming verification, and close it during Task 7's device pass.
