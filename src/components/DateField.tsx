import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { formatDisplayDate, toIsoDate } from '@/lib/date';
import { dateFieldStyles as styles } from './dateFieldStyles';
import { TextButton } from './TextButton';

type Props = {
  label: string;
  /** ISO YYYY-MM-DD, or '' when nothing is chosen yet. */
  value: string;
  onChange: (iso: string) => void;
};

// Native: tapping the value opens the platform date picker. The value stays ISO
// on the way in and out; only the display is "18 July 2026".
export function DateField({ label, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  // Local midnight (no trailing Z) so toIsoDate round-trips the same calendar day.
  const current = value ? new Date(`${value}T00:00:00`) : new Date();

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
        <>
          <DateTimePicker
            value={current}
            mode="date"
            // iOS 'default' resolves to the compact pill on iOS 14+, which would
            // sit under our own field as a second date control needing a second
            // tap. 'inline' opens Apple's full calendar right there instead.
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(event, selected) => {
              // Android's dialog dismisses itself and reports set/dismissed;
              // iOS fires on every spin, so it stays open until Done.
              if (Platform.OS !== 'ios') setOpen(false);
              if (event.type === 'set' && selected) onChange(toIsoDate(selected));
            }}
          />
          {Platform.OS === 'ios' ? (
            <TextButton label="Done" onPress={() => setOpen(false)} />
          ) : null}
        </>
      ) : null}
    </View>
  );
}
