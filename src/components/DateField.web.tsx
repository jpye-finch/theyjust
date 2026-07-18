import { useRef } from 'react';
import { Text, View } from 'react-native';
import { formatDisplayDate } from '@/lib/date';
import { dateFieldStyles as styles } from './dateFieldStyles';

type Props = {
  label: string;
  /** ISO YYYY-MM-DD, or '' when nothing is chosen yet. */
  value: string;
  onChange: (iso: string) => void;
};

// Web: keep the book-form look but hand the interaction to the browser's own
// date picker. A transparent <input type="date"> covers the field, so clicking
// anywhere opens the native calendar and we get ISO values back for free —
// while the visible text stays "18 July 2026" rather than a locale mm/dd/yyyy.
export function DateField({ label, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.input}>
        <Text style={value ? styles.value : styles.placeholder}>
          {value ? formatDisplayDate(value) : 'Choose a date'}
        </Text>
        <input
          ref={inputRef}
          type="date"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // Chrome only opens the calendar from the icon unless asked directly.
          onClick={() => {
            const el = inputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
            el?.showPicker?.();
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        />
      </View>
    </View>
  );
}
