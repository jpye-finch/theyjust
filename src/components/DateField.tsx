import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { formatDisplayDate, toIsoDate } from '@/lib/date';
import { color } from '@/theme/tokens';
import { dateFieldStyles as styles } from './dateFieldStyles';

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

  // iOS: the system control IS the field. We used to draw our own row and then
  // unfold Apple's 'inline' calendar beneath it — a whole month grid pushing the
  // form open, in system blue, with a Done button we had to supply ourselves.
  // 'compact' is what iOS forms actually do: a date you tap, and Apple presents
  // its calendar in a popover above the page. It brings its own chrome, so the
  // underline comes off here rather than fighting it.
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        {value ? (
          <View style={styles.nativeRow}>
            <DateTimePicker
              value={asDate(value)}
              mode="date"
              display="compact"
              // The compact control centres itself in whatever width it is
              // handed, which floated it to the middle of the sheet. It has to
              // opt out itself — alignItems on the parent is not enough.
              style={styles.nativePicker}
              // Damson, so the popover's selection is ours and not system blue.
              accentColor={color.damson}
              onChange={(_event, selected) => {
                if (selected) onChange(toIsoDate(selected));
              }}
            />
          </View>
        ) : (
          // The compact control cannot show "nothing chosen" — it always renders
          // some date. So an unset field keeps our own placeholder, and the first
          // tap seeds today for the parent to adjust. Only a new child's date of
          // birth starts empty; capture always opens on today.
          <Pressable
            style={styles.input}
            onPress={() => onChange(toIsoDate(new Date()))}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Text style={styles.placeholder}>Choose a date</Text>
          </Pressable>
        )}
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
