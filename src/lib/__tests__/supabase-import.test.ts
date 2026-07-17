import { createClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';

describe('supabase-js under jest', () => {
  it('imports and constructs a client', () => {
    const client = createClient('http://localhost:54321', 'test-anon-key');
    expect(client.auth).toBeDefined();
  });

  it('constructs the app client under jest', () => {
    expect(supabase.auth).toBeDefined();
  });
});
