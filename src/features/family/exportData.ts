import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import { Platform } from 'react-native';
import { fetchChildren } from '../children/queries';
import { fetchTimeline } from '../moments/momentQueries';
import { signedPhotoUrl } from '../moments/photoUpload';
import { buildExportBundle, photoFileName } from './exportBundle';

// Everything here is read with the parent's own session, so RLS is what keeps
// the export scoped to their family. Photos are pulled through short-lived
// signed URLs, the same way the app displays them.
export async function exportEverything(exportedAt: string): Promise<void> {
  const children = await fetchChildren();
  const moments = (await Promise.all(children.map((child) => fetchTimeline(child.id)))).flat();

  const zip = new JSZip();
  zip.file(
    'firsts-export.json',
    JSON.stringify(buildExportBundle(exportedAt, children, moments), null, 2),
  );

  const photos = zip.folder('photos');
  for (const moment of moments) {
    for (const photo of moment.moment_photos) {
      const url = await signedPhotoUrl(photo.storage_path);
      if (!url) continue;
      const blob = await (await fetch(url)).blob();
      photos?.file(photoFileName(photo.storage_path), blob);
    }
  }

  const fileName = `firsts-export-${exportedAt.slice(0, 10)}.zip`;

  if (Platform.OS === 'web') {
    // No share sheet on web: hand the browser a download instead.
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  const base64 = await zip.generateAsync({ type: 'base64' });
  const target = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(target, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(target);
  }
}
