import { Link } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { OrDivider } from '@/components/OrDivider';
import { AppleSignInButton } from '@/features/auth/AppleSignInButton';
import { signInWithApple } from '@/features/auth/appleSignIn';
import { AuthForm } from '@/features/auth/AuthForm';
import { supabase } from '@/lib/supabase';
import { color, font, space, type } from '@/theme/tokens';

export default function SignIn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async (email: string, password: string) => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    setBusy(false);
    // On success the root layout's auth gate redirects automatically.
  };

  const continueWithApple = async () => {
    // Apple's sheet takes a moment to animate in and the button gives no
    // feedback in that gap, so a double-tap here would fire two concurrent
    // native signInAsync() requests. Bail out if one is already in flight.
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await signInWithApple();
    // 'cancelled' says nothing: the parent backed out on purpose and does not
    // need to be told what they just did.
    if (result.status === 'failed') setError(result.message);
    setBusy(false);
    // On success the root layout's auth gate redirects automatically.
  };

  return (
    <View style={styles.screen}>
      <View style={styles.brand}>
        {/* The splash composition, not the app icon: this screen's background
            is paper, and the splash mark is the one cut designed for it — a
            damson ribbon whose dot is knocked through to transparency, so the
            paper reads through the hole. The app icon would drop a damson
            square onto a paper screen; the Android foreground is a paper
            ribbon and would vanish entirely. */}
        <Image
          testID="brand-mark"
          accessible={false}
          source={require('../../../assets/images/splash-icon.png')}
          style={styles.mark}
          resizeMode="contain"
        />
        <Text style={styles.title}>Firsts</Text>
        <Text style={styles.subtitle}>Every first, remembered.</Text>
      </View>
      <AppleSignInButton onPress={continueWithApple} />
      <OrDivider />
      <AuthForm submitLabel="Sign in" onSubmit={signIn} error={error} busy={busy} />
      <Link href="/(auth)/sign-up" style={styles.link}>
        New here? Create an account
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: space.xl,
    gap: space.xl,
    backgroundColor: color.paper,
  },
  brand: { alignItems: 'center', gap: space.xs, marginBottom: space.sm },
  // The mark's canvas is square, but the ribbon only occupies its top ~72% —
  // it bleeds off the top edge by design and leaves transparent space below.
  // Without the negative margin that dead space reads as an oversized gap
  // between the mark and the wordmark.
  mark: { width: 120, height: 120, marginBottom: -space.xl },
  title: { fontFamily: font.displayBold, fontSize: 40, color: color.ink, letterSpacing: -0.5 },
  subtitle: { fontFamily: font.serifItalic, fontSize: type.title, color: color.damson },
  link: {
    fontFamily: font.medium,
    fontSize: type.label,
    textAlign: 'center',
    marginTop: space.sm,
    color: color.inkMuted,
  },
});
