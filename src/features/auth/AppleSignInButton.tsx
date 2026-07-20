import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { radius, space } from '@/theme/tokens';

type Props = { onPress: () => void };

// Apple's own button, not ours: its wording, proportions and logo are governed
// by the Human Interface Guidelines, and a hand-drawn imitation is a review
// risk for no gain. Same reasoning that accepted the system date picker — a
// system control is exempt from our chrome rules. cornerRadius is the one part
// we own, matched to PrimaryButton so the two sit together.
//
// Seeded true on iOS: IPHONEOS_DEPLOYMENT_TARGET is 16.4, so the "unavailable
// on this iOS" case cannot occur on any device this ships to, and starting
// from false only pushed the vertically-centred form down a beat later. The
// async isAvailableAsync() check below still runs and stays the real
// authority — it is what turns the button off on Android and web, and it
// would still catch a genuine iOS regression.
export function AppleSignInButton({ onPress }: Props) {
  const [available, setAvailable] = useState(Platform.OS === 'ios');

  useEffect(() => {
    let cancelled = false;
    AppleAuthentication.isAvailableAsync().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!available) return null;

  return (
    <AppleAuthentication.AppleAuthenticationButton
      testID="apple-sign-in"
      // "Continue" rather than "Sign in": one tap both creates the account and
      // returns to it, and the parent should not have to know which is which.
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      // Black on warm paper. WHITE would vanish into the page.
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={radius.md}
      style={styles.button}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  // The native view has no intrinsic height; without one it collapses to zero
  // and the button is invisible with no error to explain it.
  button: { height: 50, marginBottom: space.md },
});
