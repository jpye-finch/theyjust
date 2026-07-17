import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthForm } from '@/features/auth/AuthForm';
import { supabase } from '@/lib/supabase';

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

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>TheyJust</Text>
      <Text style={styles.subtitle}>Every first, remembered.</Text>
      <AuthForm submitLabel="Sign in" onSubmit={signIn} error={error} busy={busy} />
      <Link href="/(auth)/sign-up" style={styles.link}>
        New here? Create an account
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 34, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#666', marginBottom: 24 },
  link: { textAlign: 'center', marginTop: 16, color: '#1a1a2e' },
});
