import { useEffect, useState } from 'react';
import type { MomentPhoto } from './momentQueries';
import { signedPhotoUrl } from './photoUpload';

/** Photos in the order a parent added them. */
export function byPosition(photos: MomentPhoto[]): MomentPhoto[] {
  return [...photos].sort((a, b) => a.position - b.position);
}

// The bucket is private, so every photo needs a short-lived signed URL before it
// can be displayed. Keyed on the photos' ids and paths rather than the array
// itself: react-query hands back a fresh array on every refetch, and depending
// on that identity spun this effect's setState in a loop (the same trap the
// Timeline's empty state hit).
export function useSignedUrls(photos: MomentPhoto[]): Record<string, string | null> {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const key = photos.map((p) => `${p.id}:${p.storage_path}`).join('|');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        photos.map(async (p) => [p.id, await signedPhotoUrl(p.storage_path)] as const),
      );
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}
