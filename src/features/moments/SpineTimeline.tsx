import { useMemo } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { color, space } from '@/theme/tokens';
import type { Moment } from './momentQueries';
import { layoutSpine, type SpineRow as Row } from './spineLayout';
import { SpineRow } from './SpineRow';

type Props = {
  dateOfBirth: string;
  dueDate: string | null;
  moments: Moment[];
  photoUrls: Record<string, string>;
  onOpenMoment: (momentId: string) => void;
};

export function SpineTimeline({ dateOfBirth, dueDate, moments, photoUrls, onOpenMoment }: Props) {
  const rows = useMemo(
    () => layoutSpine({ dateOfBirth, dueDate, moments }),
    [dateOfBirth, dueDate, moments],
  );

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(row) => row.key}
      // Every row's height is already known, so the list never has to measure
      // and scrolling stays O(1) across a five-year spine.
      getItemLayout={(_, index) => ({
        length: rows[index].height,
        offset: rows[index].offset,
        index,
      })}
      renderItem={({ item }: { item: Row }) => (
        <SpineRow
          row={item}
          photoUrl={(item.momentId && photoUrls[item.momentId]) || null}
          onPress={() => item.momentId && onOpenMoment(item.momentId)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: color.paper },
  content: { paddingTop: space.sm, paddingBottom: space.xxl },
});
