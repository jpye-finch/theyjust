import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  submitLabel: string;
  onSubmit: (email: string, password: string) => void;
  error?: string | null;
  busy?: boolean;
};

export function AuthForm({ submitLabel, onSubmit, error, busy }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handlePress = () => {
    const trimmed = email.trim();
    if (!trimmed || !password) {
      setLocalError('Enter your email and password');
      return;
    }
    setLocalError(null);
    onSubmit(trimmed, password);
  };

  const message = error ?? localError;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />
      {message ? <Text style={styles.error}>{message}</Text> : null}
      <Pressable style={styles.button} onPress={handlePress} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? '…' : submitLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  error: { color: '#b00020' },
  button: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
