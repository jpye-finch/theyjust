import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDisplayDate, toIsoDate } from '@/lib/date';
import { color, space } from '@/theme/tokens';
import { dateFieldStyles as styles } from './dateFieldStyles';
import { TextButton } from './TextButton';

type Props = {
  label: string;
  /** ISO YYYY-MM-DD, or '' when nothing is chosen yet. */
  value: string;
  onChange: (iso: string) => void;
};

// Local midnight (no trailing Z) so toIsoDate round-trips the same calendar day.
const asDate = (value: string) => (value ? new Date(`${value}T00:00:00`) : new Date());

// Native: tapping the value opens the platform date picker. The value stays ISO
// on the way in and out; only the display is "18 July 2026".
export function DateField({ label, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  // Held while the modal is up so the parent only hears a real choice.
  const [draft, setDraft] = useState<string | null>(null);
  // The panel sits on the bottom edge, so it owes the home indicator its room.
  const insets = useSafeAreaInsets();

  // iOS: once a date exists, the system control IS the field — tap it and Apple
  // presents its calendar in a popover, which is what iOS forms actually do.
  if (Platform.OS === 'ios') {
    if (value) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.nativeRow}>
            <DateTimePicker
              value={asDate(value)}
              mode="date"
              display="compact"
              // The compact control centres itself in whatever width it is
              // handed; alignItems on the parent cannot override that.
              style={styles.nativePicker}
              accentColor={color.damson}
              onChange={(_event, selected) => {
                if (selected) onChange(toIsoDate(selected));
              }}
            />
          </View>
        </View>
      );
    }

    // Empty is its own state, and it must stay empty until the parent actually
    // picks. Seeding today on the first tap looked like an answer they had
    // given: a due date of "today" for a premature baby passes validation and
    // then quietly feeds a wrong corrected age into every milestone. An unset
    // date is caught; a plausible wrong one is not.
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        <Pressable
          style={styles.input}
          onPress={() => {
            setDraft(null);
            setOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <Text style={styles.placeholder}>Choose a date</Text>
        </Pressable>
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.panel, { paddingBottom: insets.bottom + space.md }]}>
            <View style={styles.panelHead}>
              <Text style={styles.label}>{label}</Text>
              <TextButton
                label="Done"
                onPress={() => {
                  // No spin, no date: closing without choosing leaves it unset.
                  if (draft) onChange(draft);
                  setOpen(false);
                }}
              />
            </View>
            <DateTimePicker
              value={asDate(draft ?? '')}
              mode="date"
              display="inline"
              accentColor={color.damson}
              onChange={(_event, selected) => {
                if (selected) setDraft(toIsoDate(selected));
              }}
            />
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.input}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={value ? styles.value : styles.placeholder}>
          {value ? formatDisplayDate(value) : 'Choose a date'}
        </Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={asDate(value)}
          mode="date"
          display="default"
          onChange={(event, selected) => {
            // Android's dialog dismisses itself and reports set/dismissed.
            setOpen(false);
            if (event.type === 'set' && selected) onChange(toIsoDate(selected));
          }}
        />
      ) : null}
    </View>
  );
}
