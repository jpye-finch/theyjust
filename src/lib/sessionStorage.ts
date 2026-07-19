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
