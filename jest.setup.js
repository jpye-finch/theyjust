// Deterministic non-UTC timezone so UTC-vs-local date leaks fail in CI too.
// NOTE: the EFFECTIVE pin is `TZ=America/Los_Angeles` in the npm "test" script.
// V8 caches the zone before setupFiles runs, so setting it here alone is a no-op
// (proven: Intl still reported the host zone). Kept as intent documentation and
// for any runner that reads process.env.TZ before launching Node.
process.env.TZ = 'America/Los_Angeles';

process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
