import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthForm } from '@/features/auth/AuthForm';
import { supabase } from '@/lib/supabase';
import { color, font, space, type } from '@/theme/tokens';

export default function SignUp() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signUp = async (email: string, password: string) => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signUp({ email, password });
    if (err) setError(err.message);
    setBusy(false);
    // Local dev has email confirmation disabled, so this signs the user
    // straight in and the auth gate redirects.
  };

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
  link: {
    fontFamily: font.medium,
    fontSize: type.label,
    textAlign: 'center',
    marginTop: space.sm,
    color: color.inkMuted,
  },
});
