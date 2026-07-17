import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Field } from '@/components/Field';
import { PrimaryButton } from '@/components/PrimaryButton';
import { color, font, space, type } from '@/theme/tokens';
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
      <Field label="Name" placeholder="Name" value={name} onChangeText={setName} />
      <Field
        label="Date of birth"
        placeholder="Date of birth (YYYY-MM-DD)"
        autoCapitalize="none"
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Born before 37 weeks?</Text>
        <Switch
          value={premature}
          onValueChange={setPremature}
          accessibilityLabel="Born before 37 weeks"
          trackColor={{ true: color.damson, false: color.rule }}
          thumbColor={color.paper}
        />
      </View>
      {premature ? (
        <Field
          label="Due date"
          placeholder="Due date (YYYY-MM-DD)"
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
      <PrimaryButton label={submitLabel} onPress={handlePress} busy={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.lg },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontFamily: font.body, fontSize: type.body, color: color.ink },
  error: { fontFamily: font.medium, fontSize: type.label, color: color.damson },
});
