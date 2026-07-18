// Deno Edge Function. Deletes the caller's account: their photos from storage,
// any family they are the last member of (the DB cascades children, moments and
// photo rows), their memberships, and finally their auth user.
//
// It runs with the service role, so the FIRST thing it does is establish who is
// actually calling by verifying their JWT. Nothing is derived from the body.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') as string,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string,
  );

  const { data: caller, error: callerError } = await admin.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (callerError || !caller?.user) {
    return new Response(JSON.stringify({ error: 'Not signed in' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const userId = caller.user.id;

  const { data: memberships } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId);

  // Only families where nobody else is left may be destroyed.
  const familyIds = (memberships ?? []).map((m) => m.family_id as string);
  const soleOwned: string[] = [];
  for (const familyId of familyIds) {
    const { count } = await admin
      .from('family_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('family_id', familyId);
    if ((count ?? 0) <= 1) soleOwned.push(familyId);
  }

  if (soleOwned.length > 0) {
    const { data: children } = await admin
      .from('children')
      .select('id')
      .in('family_id', soleOwned);
    const childIds = (children ?? []).map((c) => c.id as string);

    if (childIds.length > 0) {
      const { data: moments } = await admin.from('moments').select('id').in('child_id', childIds);
      const momentIds = (moments ?? []).map((m) => m.id as string);

      if (momentIds.length > 0) {
        const { data: photos } = await admin
          .from('moment_photos')
          .select('storage_path')
          .in('moment_id', momentIds);
        const paths = (photos ?? []).map((p) => p.storage_path as string);
        // Storage objects never cascade, and SQL cannot delete them: a
        // storage.protect_delete() trigger blocks that, so they must go through
        // the Storage API. Do it BEFORE the rows that name them, or the paths
        // are lost and the blobs are stranded in the bucket forever.
        if (paths.length > 0) {
          const { error: storageError } = await admin.storage
            .from('moment-photos')
            .remove(paths);
          // Stop rather than press on: deleting the rows now would orphan the
          // objects with nothing left pointing at them. The parent can retry,
          // and a still-deletable account is the recoverable direction.
          if (storageError) {
            return new Response(JSON.stringify({ error: storageError.message }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }
      }
    }

    // Cascades children -> moments -> moment_photos, plus invites and memberships.
    const { error: familyError } = await admin.from('families').delete().in('id', soleOwned);
    if (familyError) {
      return new Response(JSON.stringify({ error: familyError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  await admin.from('family_members').delete().eq('user_id', userId);

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ deleted: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
