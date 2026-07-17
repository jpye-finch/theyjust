import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { ChildInput } from './queries';

type Props = {
  submitLabel: string;
  onSubmit: (input: ChildInput) => void;
  initial?: ChildInput;
  /** Server-side failure (e.g. from useCreateChild().error) — AuthForm pattern. */
  error?: string | null;
  busy?: boolean;
};

function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export function ChildForm({ submitLabel, onSubmit, initial, error, busy }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(initial?.dateOfBirth ?? '');
  const [premature, setPremature] = useState(initial?.dueDate != null);
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  const handlePress = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setLocalError('Enter a name');
      return;
    }
    if (!isRealDate(dateOfBirth)) {
      setLocalError('Enter the date of birth as YYYY-MM-DD');
      return;
    }
    if (premature) {
      if (!isRealDate(dueDate)) {
        setLocalError('Enter the due date as YYYY-MM-DD');
        return;
      }
      if (dueDate <= dateOfBirth) {
        setLocalError('The due date should be after the date of birth');
        return;
      }
    }
    setLocalError(null);
    onSubmit({ name: trimmedName, dateOfBirth, dueDate: premature ? dueDate : null });
  };

  // Local validation is freshest — it must not be masked by a stale server error.
  const message = localError ?? error;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Name"
        accessibilityLabel="Name"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Date of birth (YYYY-MM-DD)"
        accessibilityLabel="Date of birth"
        autoCapitalize="none"
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Born before 37 weeks?</Text>
        <Switch value={premature} onValueChange={setPremature} accessibilityLabel="Born before 37 weeks" />
      </View>
      {premature ? (
        <TextInput
          style={styles.input}
          placeholder="Due date (YYYY-MM-DD)"
          accessibilityLabel="Due date"
          autoCapitalize="none"
          value={dueDate}
          onChangeText={setDueDate}
        />
      ) : null}
      {message ? (
        <Text style={styles.error} role="alert" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
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
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 16 },
  error: { color: '#b00020' },
  button: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
