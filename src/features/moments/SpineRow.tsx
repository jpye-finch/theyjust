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

export function SpineRow({ row, photoUrl, onPress }: Props) {
  // An age divider is a row of its own now, so it can run the full width of the
  // screen and read as a chapter rule. It never has to dodge a moment, because
  // nothing else occupies its line.
  if (row.kind === 'rule') {
    return (
      <View style={[styles.row, { height: row.height }]}>
        <View style={styles.spine} />
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>{row.title}</Text>
          <View style={styles.dividerLine} />
        </View>
      </View>
    );
  }

  const openable = row.momentId !== null;
  return (
    // The row's height IS the distance down to the row below it, so the empty
    // stretch beneath the head is the elapsed time.
    <View style={[styles.row, { height: row.height }]}>
      <View style={styles.spine} />
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
  // ROW_HEAD, not a local 44: the layout module reserves exactly this much for a
  // moment's head, so the two must never drift apart.
  head: { flexDirection: 'row', alignItems: 'center', height: ROW_HEAD, paddingRight: space.lg },
  date: {
    // Wide enough for dd/mm/yyyy on one line — at 64px it wrapped to "22/05/20"
    // over "25", which read as two different dates.
    fontFamily: font.body,
    fontSize: type.caption,
    color: color.inkMuted,
    // Tabular figures keep the date column from shuffling as the digits change.
    fontVariant: ['tabular-nums'],
  },
  dateColumn: { width: DATE_WIDTH, alignItems: 'flex-end' },
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
  // Edge to edge, crossing the spine: a divider marks the whole page, not one
  // column of it. Sits at the TOP of its row, so the space below it is the time
  // that then passes.
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: ROW_HEAD,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: color.rule },
  dividerLabel: { fontFamily: font.medium, fontSize: type.caption, color: color.inkMuted },
});
