import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Field } from '@/components/Field';
import { PrimaryButton } from '@/components/PrimaryButton';
import { color, font, space, type } from '@/theme/tokens';

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

  // Local validation is freshest — it must not be masked by a stale server error.
  const message = localError ?? error;

  return (
    <View style={styles.container}>
      <Field
        label="Email"
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Field
        label="Password"
        placeholder="Password"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />
      {message ? (
        <Text style={styles.error} role="alert" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
      <PrimaryButton label={submitLabel} onPress={handlePress} busy={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.lg },
  error: { fontFamily: font.medium, fontSize: type.label, color: color.damson },
});
