// SDK 57 moved the classic file API to /legacy; the main entry's
// readAsStringAsync is a deprecation stub that throws at runtime (and still
// type-checks, so tsc can't catch it). The /legacy path has the real impl.
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { RESIZE, photoObjectPath } from './photoPath';

export type PickedPhoto = { uri: string; width: number; height: number };

// Present the library (web: the browser file input). Returns null if cancelled.
export async function pickPhoto(): Promise<PickedPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const a = result.assets[0];
  return { uri: a.uri, width: a.width, height: a.height };
}

// Resize the long edge to RESIZE.maxDimension and re-encode as JPEG.
export async function resizePhoto(photo: PickedPhoto): Promise<PickedPhoto> {
  const longEdge = Math.max(photo.width, photo.height);
  const actions =
    longEdge > RESIZE.maxDimension
      ? [
          photo.width >= photo.height
            ? { resize: { width: RESIZE.maxDimension } }
            : { resize: { height: RESIZE.maxDimension } },
        ]
      : [];
  const out = await ImageManipulator.manipulateAsync(photo.uri, actions, {
    compress: RESIZE.compress,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: out.uri, width: out.width, height: out.height };
}

// Read the resized file into a body supabase-js can upload. expo-file-system is
// native-only: on web the manipulator hands back a blob:/data: URL, so fetch it
// straight back into a Blob there. (Reading it the native way on web threw, and
// that is why no photo ever reached storage.)
async function readForUpload(uri: string): Promise<Blob | Uint8Array> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    return await res.blob();
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

// Upload the (already-resized) file and record it. photoId is any unique string
// (crypto.randomUUID at the call site) so the object path is stable.
export async function uploadMomentPhoto(
  momentId: string,
  photoId: string,
  photo: PickedPhoto,
  position: number,
): Promise<void> {
  const path = photoObjectPath(momentId, photoId);
  const body = await readForUpload(photo.uri);
  const { error: upErr } = await supabase.storage
    .from('moment-photos')
    .upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw upErr;
  const { error: rowErr } = await supabase.from('moment_photos').insert({
    moment_id: momentId,
    storage_path: path,
    width: photo.width,
    height: photo.height,
    position,
  });
  if (rowErr) throw rowErr;
}

// Short-lived signed URL for display (the bucket is private).
export async function signedPhotoUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('moment-photos')
    .createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data.signedUrl;
}
