import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { queryClient } from '../../lib/queryClient';
import { supabase } from '../../lib/supabase';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      // A signed-out device must hold no family data in memory: the next
      // account to sign in must never see the previous family's cache.
      if (event === 'SIGNED_OUT') queryClient.clear();
      setSession(next);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}
