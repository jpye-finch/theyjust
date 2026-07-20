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

// The value stays ISO on the way in and out; only the display is "18 July 2026".
export function DateField({ label, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  // Held while the calendar is up so the parent only hears a real choice.
  const [draft, setDraft] = useState<string | null>(null);
  // The panel sits on the bottom edge, so it owes the home indicator its room.
  const insets = useSafeAreaInsets();

  const openPicker = () => {
    setDraft(value || null);
    setOpen(true);
  };

  const field = (
    <Pressable
      style={styles.input}
      onPress={openPicker}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={value ? styles.value : styles.placeholder}>
        {value ? formatDisplayDate(value) : 'Choose a date'}
      </Text>
    </Pressable>
  );

  // iOS: one field, one calendar, whether or not a date is set already. There
  // used to be two — the compact control once a value existed, our own row
  // before that — which meant the same question wore two faces depending on
  // state. The full-width calendar is the one worth keeping: it is Apple's own,
  // it leaves the field in our type rather than a system pill, and it shows the
  // date the way the rest of the app writes it.
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        {field}
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.panel, { paddingBottom: insets.bottom + space.md }]}>
            <View style={styles.panelHead}>
              <Text style={styles.label}>{label}</Text>
              <TextButton
                label="Done"
                onPress={() => {
                  // Opened without touching a date, on a field that had none:
                  // it stays empty. A date nobody chose is worse than no date,
                  // because validation catches the second and not the first.
                  if (draft) onChange(draft);
                  setOpen(false);
                }}
              />
            </View>
            <DateTimePicker
              value={asDate(draft ?? value)}
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
      {field}
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
