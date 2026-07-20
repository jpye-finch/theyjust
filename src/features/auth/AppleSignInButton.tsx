import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { radius, space } from '@/theme/tokens';

type Props = { onPress: () => void };

// Apple's own button, not ours: its wording, proportions and logo are governed
// by the Human Interface Guidelines, and a hand-drawn imitation is a review
// risk for no gain. Same reasoning that accepted the system date picker — a
// system control is exempt from our chrome rules. cornerRadius is the one part
// we own, matched to PrimaryButton so the two sit together.
//
// Availability is asked rather than assumed: it is false on Android, on web,
// and on iOS below 13. Rendering a button that cannot work and cannot say why
// is worse than rendering nothing.
export function AppleSignInButton({ onPress }: Props) {
  const [available, setAvailable] = useState(false);

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
