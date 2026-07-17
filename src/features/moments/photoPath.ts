// The object path's first segment MUST be the moment id: the storage RLS policy
// (migration 20260717000001) reads it back with storage.foldername(name)[1] to
// find the moment and check family membership.
export function photoObjectPath(momentId: string, photoId: string): string {
  return `${momentId}/${photoId}.jpg`;
}

// Client-side resize before upload: cap the long edge and re-encode as JPEG so
// a phone camera's multi-MB original becomes a lean, storage-cheap file.
export const RESIZE = {
  maxDimension: 2048,
  compress: 0.8,
} as const;
