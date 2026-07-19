import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { color, font, radius, space, type } from '@/theme/tokens';
import { ROW_HEAD, type SpineRow as Row } from './spineLayout';

type Props = {
  row: Row;
  photoUrl: string | null;
  onPress: () => void;
};

const DOT_SIZE = 9;
// "30 Sep" is the widest label this column ever holds — dropping the year from
// every row bought back roughly a third of it, which the titles get instead.
const DATE_WIDTH = 50;
const SPINE_LEFT = 62;
// Rules live entirely to the RIGHT of the spine. Full-width rules crossed the
// date column and the spine itself, and — twelve of them down one long gap —
// shouted louder than the moments they were meant to measure.
const RULE_LEFT = SPINE_LEFT + 60;

export function SpineRow({ row, photoUrl, onPress }: Props) {
  const openable = row.momentId !== null;
  return (
    // The row's height IS the gap that follows it, so the empty stretch below
    // the head is the elapsed time, and the age rules live inside it.
    <View style={[styles.row, { height: row.height }]}>
      <View style={styles.spine} />

      {row.rules.map((rule) => (
        <View key={rule.label} style={[styles.rule, { top: rule.offset }]}>
          <View style={styles.ruleLine} />
          <Text style={styles.ruleLabel}>{rule.label}</Text>
          <View style={styles.ruleLine} />
        </View>
      ))}

      <Pressable
        style={styles.head}
        onPress={openable ? onPress : undefined}
        disabled={!openable}
        accessibilityRole={openable ? 'button' : undefined}
      >
        {/* Both slots stay in the layout even when empty, so the dots and titles
            of a same-day cluster still line up under the row that names it. */}
        <View style={styles.dateColumn}>
          {row.dateLabel ? (
            <Text style={styles.date} numberOfLines={1}>
              {row.dateLabel}
            </Text>
          ) : null}
          {row.yearLabel ? (
            <Text style={styles.year} numberOfLines={1}>
              {row.yearLabel}
            </Text>
          ) : null}
        </View>
        <View style={styles.dot} />
        <Text style={styles.title} numberOfLines={2}>
          {row.title}
        </Text>
        {photoUrl ? (
          <Image
            testID="spine-thumb"
            accessible={false}
            source={{ uri: photoUrl }}
            style={styles.thumb}
            resizeMode="cover"
          />
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'relative' },
  spine: {
    position: 'absolute',
    left: SPINE_LEFT,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: color.ink,
    opacity: 0.35,
  },
  // ROW_HEAD, not a local 44: the layout module suppresses rules that would fall
  // inside this head, so the two must never drift apart.
  head: { flexDirection: 'row', alignItems: 'center', height: ROW_HEAD, paddingRight: space.lg },
  dateColumn: { width: DATE_WIDTH, alignItems: 'flex-end' },
  date: {
    fontFamily: font.body,
    fontSize: type.caption,
    color: color.inkMuted,
    // Tabular figures keep the date column from shuffling as the digits change.
    fontVariant: ['tabular-nums'],
  },
  // The year is a heading for the run of dates beneath it, not part of any one
  // date, so it sits quieter and smaller than the day it introduces.
  year: {
    fontFamily: font.medium,
    fontSize: 11,
    color: color.inkMuted,
    opacity: 0.75,
    fontVariant: ['tabular-nums'],
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: color.ink,
    marginLeft: SPINE_LEFT - DATE_WIDTH - DOT_SIZE / 2,
  },
  title: {
    flex: 1,
    marginLeft: space.md,
    fontFamily: font.display,
    fontSize: type.label,
    color: color.ink,
  },
  thumb: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: color.paperRaise },
  rule: {
    position: 'absolute',
    left: RULE_LEFT,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  ruleLine: { flex: 1, height: 1, backgroundColor: color.rule },
  ruleLabel: { fontFamily: font.medium, fontSize: type.caption, color: color.inkMuted },
});
