import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthForm } from '@/features/auth/AuthForm';
import { supabase } from '@/lib/supabase';
import { color, font, space, type } from '@/theme/tokens';

export default function SignUp() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const signUp = async (email: string, password: string) => {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    // With email confirmation on, Supabase returns a user but no session. There
    // is nothing for the auth gate to redirect on, so the screen has to say so
    // itself — otherwise Sign up looks like it silently did nothing.
    if (!data.session) setPendingEmail(email);
  };

  if (pendingEmail) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.blurb}>
          {`We sent a confirmation link to ${pendingEmail}. Tap it and you are in.`}
        </Text>
        <Link href="/(auth)/sign-in" style={styles.link}>
          Back to sign in
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Create account</Text>
      <AuthForm submitLabel="Sign up" onSubmit={signUp} error={error} busy={busy} />
      <Link href="/(auth)/sign-in" style={styles.link}>
        Already have an account? Sign in
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
  title: {
    fontFamily: font.display,
    fontSize: type.hero,
    color: color.ink,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  blurb: {
    fontFamily: font.body,
    fontSize: type.body,
    color: color.inkMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  link: {
    fontFamily: font.medium,
    fontSize: type.label,
    textAlign: 'center',
    marginTop: space.sm,
    color: color.inkMuted,
  },
});
