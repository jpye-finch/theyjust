import { Button, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function Home() {
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>Signed in 🎉 — timeline coming in Plan 3</Text>
      <Button title="Sign out" onPress={() => supabase.auth.signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  text: { fontSize: 16 },
});
