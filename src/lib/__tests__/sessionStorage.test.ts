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
    expect(mockedSecure.setItemAsync).toHaveBeenCalledWith('sb-session-key', expect.any(String));
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
