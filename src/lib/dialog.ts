import { Alert, Platform } from 'react-native';

// react-native's Alert has no UI on react-native-web: Alert.alert() is a silent
// no-op there, so every error message and confirm simply vanished on web (a
// failed save looked like nothing happened, and Delete was unreachable). Route
// through the browser's own dialogs on web; keep the native Alert elsewhere.

export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function confirmDestructive(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Keep it', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
