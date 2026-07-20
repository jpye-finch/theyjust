import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
        <Text style={styles.title}>Firsts</Text>
        <Text style={styles.subtitle}>Every first, remembered.</Text>
      </View>
      <AppleSignInButton onPress={continueWithApple} />
      <View style={styles.orRow}>
        <View style={styles.orRule} />
        <Text style={styles.orText}>or</Text>
        <View style={styles.orRule} />
      </View>
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
  title: { fontFamily: font.displayBold, fontSize: 40, color: color.ink, letterSpacing: -0.5 },
  subtitle: { fontFamily: font.serifItalic, fontSize: type.title, color: color.damson },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  orRule: { flex: 1, height: 1, backgroundColor: color.rule },
  orText: { fontFamily: font.body, fontSize: type.caption, color: color.inkMuted },
  link: {
    fontFamily: font.medium,
    fontSize: type.label,
    textAlign: 'center',
    marginTop: space.sm,
    color: color.inkMuted,
  },
});
