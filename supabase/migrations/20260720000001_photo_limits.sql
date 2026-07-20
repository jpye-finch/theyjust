-- Guard the moment-photos bucket against junk uploads: a non-image, or a file
-- large enough to break the UI or run up storage cost. Enforced by Storage
-- itself, so it holds even for a client that bypasses the app's own resize
-- step — the RLS policies decide WHO may write, these decide WHAT.
--
-- The app already resizes to a long edge of RESIZE.maxDimension and re-encodes
-- as JPEG before upload, so a real photo lands far under 10 MB; the ceiling is
-- headroom, not the expected size. HEIC is allowed because that is what an
-- iPhone hands over before the pipeline re-encodes, and a future path might
-- upload it directly.
--
-- A NEW migration, not an edit to 20260717000001: that one is already applied
-- on the hosted project and its hash is recorded, so editing it in place would
-- never re-run.
update storage.buckets
set
  file_size_limit = 10485760, -- 10 MB
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id = 'moment-photos';
