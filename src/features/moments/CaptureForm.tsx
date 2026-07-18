import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextButton } from '@/components/TextButton';
import { color, font, radius, space, type } from '@/theme/tokens';
import { isRealDate } from '../../lib/date';
import { CATALOGUE, celebrationText } from '../milestones/catalogue';
import { MilestonePicker } from './MilestonePicker';

export type CaptureSubmit = {
  milestoneId: string | null;
  customTitle: string | null;
  occurredOn: string;
  note: string;
};

type Props = {
  /** Preselected catalogue milestone (from a Milestones row), or null. */
  initialMilestoneId: string | null;
  defaultOccurredOn: string;
  photoCount: number;
  onPickPhoto: () => void;
  onSubmit: (value: CaptureSubmit) => void;
  busy?: boolean;
};

export function CaptureForm({
  initialMilestoneId,
  defaultOccurredOn,
  photoCount,
  onPickPhoto,
  onSubmit,
  busy,
}: Props) {
  // defaultOccurredOn seeds state once; the capture screen mounts this form fresh
  // per moment, so the prop stays stable for the component's lifetime.
  const [milestoneId, setMilestoneId] = useState<string | null>(initialMilestoneId);
  const [customTitle, setCustomTitle] = useState('');
  const [occurredOn, setOccurredOn] = useState(defaultOccurredOn);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  // A moment is EITHER a catalogue milestone (celebration voice, and it stamps
  // the Milestones screen) or the parent's own words — never both.
  const entry = milestoneId ? CATALOGUE.find((e) => e.id === milestoneId) : undefined;
  const presetTitle = entry ? celebrationText(entry) : null;

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
      milestoneId: presetTitle === null ? null : milestoneId,
      customTitle: presetTitle === null ? trimmedTitle : null,
      occurredOn,
      note,
    });
  };

  return (
    <View style={styles.container}>
      {presetTitle !== null ? (
        <View style={styles.presetBlock}>
          <Text style={styles.presetTitle}>{presetTitle}</Text>
          <View style={styles.presetActions}>
            <TextButton label="Change milestone" onPress={() => setPicking(true)} />
            <TextButton label="Write my own" onPress={() => setMilestoneId(null)} tone="muted" />
          </View>
        </View>
      ) : (
        <View style={styles.customBlock}>
          <Field
            label="Moment"
            placeholder="What happened?"
            value={customTitle}
            onChangeText={setCustomTitle}
          />
          <TextButton label="Choose from milestones" onPress={() => setPicking(true)} />
        </View>
      )}
      <DateField label="When did it happen?" value={occurredOn} onChange={setOccurredOn} />
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
      <MilestonePicker
        visible={picking}
        onClose={() => setPicking(false)}
        onSelect={(id) => {
          setMilestoneId(id);
          setCustomTitle('');
          setError(null);
          setPicking(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.lg },
  presetBlock: { gap: space.sm },
  presetActions: { flexDirection: 'row', gap: space.lg },
  customBlock: { gap: space.xs },
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
