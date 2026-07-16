import { createClient } from '@supabase/supabase-js';

describe('supabase-js under jest', () => {
  it('imports and constructs a client', () => {
    const client = createClient('http://localhost:54321', 'test-anon-key');
    expect(client.auth).toBeDefined();
  });
});
