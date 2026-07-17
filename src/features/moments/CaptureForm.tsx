import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Field } from '@/components/Field';
import { PrimaryButton } from '@/components/PrimaryButton';
import { color, font, radius, space, type } from '@/theme/tokens';

export type CaptureSubmit = {
  customTitle: string | null;
  occurredOn: string;
  note: string;
};

type Props = {
  presetTitle: string | null;
  defaultOccurredOn: string;
  photoCount: number;
  onPickPhoto: () => void;
  onSubmit: (value: CaptureSubmit) => void;
  busy?: boolean;
};

function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export function CaptureForm({
  presetTitle,
  defaultOccurredOn,
  photoCount,
  onPickPhoto,
  onSubmit,
  busy,
}: Props) {
  const [customTitle, setCustomTitle] = useState('');
  const [occurredOn, setOccurredOn] = useState(defaultOccurredOn);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmedTitle = customTitle.trim();
    if (presetTitle === null && !trimmedTitle) {
      setError('Give this moment a name');
      return;
    }
    if (!isRealDate(occurredOn)) {
      setError('Enter the date as YYYY-MM-DD');
      return;
    }
    setError(null);
    onSubmit({
      customTitle: presetTitle === null ? trimmedTitle : null,
      occurredOn,
      note,
    });
  };

  return (
    <View style={styles.container}>
      {presetTitle !== null ? (
        <Text style={styles.presetTitle}>{presetTitle}</Text>
      ) : (
        <Field
          label="Moment"
          placeholder="What happened?"
          value={customTitle}
          onChangeText={setCustomTitle}
        />
      )}
      <Field
        label="When did it happen?"
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        value={occurredOn}
        onChangeText={setOccurredOn}
      />
      <Field
        label="Note"
        placeholder="Add a little note (optional)"
        value={note}
        onChangeText={setNote}
        multiline
      />
      <Pressable style={styles.photoAdd} onPress={onPickPhoto} accessibilityRole="button">
        <Text style={styles.photoAddText}>
          {photoCount === 0
            ? 'Add a photo'
            : `${photoCount} photo${photoCount === 1 ? '' : 's'} added`}
        </Text>
      </Pressable>
      {error ? (
        <Text style={styles.error} role="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <PrimaryButton label="Save moment" onPress={handleSubmit} busy={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.lg },
  presetTitle: { fontFamily: font.displayBold, fontSize: type.display, color: color.ink, letterSpacing: -0.3 },
  photoAdd: {
    borderWidth: 1,
    borderColor: color.rule,
    borderRadius: radius.md,
    borderStyle: 'dashed',
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  photoAddText: { fontFamily: font.medium, fontSize: type.label, color: color.damson },
  error: { fontFamily: font.medium, fontSize: type.label, color: color.damson },
});
