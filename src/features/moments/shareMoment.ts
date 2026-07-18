import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import type { View } from 'react-native';

// Capture the off-screen ShareCard to a PNG and hand it to the native share
// sheet. No-ops gracefully if sharing is unavailable on the platform.
// The param is `RefObject<View | null>` because React 19's useRef<View>(null)
// resolves to exactly that (the null-initialised overload widens the type).
export async function shareMomentCard(ref: React.RefObject<View | null>): Promise<void> {
  if (!ref.current) return;
  const uri = await captureRef(ref, { format: 'png', quality: 1 });
  if (!(await Sharing.isAvailableAsync())) return;
  await Sharing.shareAsync(uri);
}
