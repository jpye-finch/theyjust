import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field } from '@/components/Field';
import { TextButton } from '@/components/TextButton';
import { color, font, hairline, space, type } from '@/theme/tokens';
import { CATALOGUE, CATEGORY_LABELS, type MilestoneCategory } from '../milestones/catalogue';

type Props = {
  visible: boolean;
  onSelect: (milestoneId: string) => void;
  onClose: () => void;
};

// Browse the catalogue from the capture screen, so a milestone can be logged
// without first hunting for its row on the Milestones tab. Grouped by category
// and filterable, because 40 entries is too many to scan cold.
export function MilestonePicker({ visible, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  // A full-screen Modal owns its own top inset — there is no navigator above it
  // holding the header clear. The fixed padding it used to carry put the title
  // under the Dynamic Island and Cancel under the battery.
  const insets = useSafeAreaInsets();

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (Object.keys(CATEGORY_LABELS) as MilestoneCategory[])
      .map((category) => ({
        title: CATEGORY_LABELS[category],
        data: CATALOGUE.filter(
          (e) => e.category === category && (q === '' || e.title.toLowerCase().includes(q)),
        ),
      }))
      .filter((section) => section.data.length > 0);
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View testID="picker-header" style={[styles.header, { paddingTop: insets.top + space.md }]}>
          <Text style={styles.title}>Choose a milestone</Text>
          <TextButton label="Cancel" onPress={onClose} tone="muted" />
        </View>
        <View style={styles.search}>
          <Field
            label="Search"
            placeholder="Search milestones"
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(entry) => entry.id}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => onSelect(item.id)}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <Text style={styles.rowTitle}>{item.title}</Text>
              {/* Signals the row acts, rather than reading as a static list. */}
              <Feather name="chevron-right" size={18} color={color.inkMuted} />
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No milestones match that.</Text>}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    // paddingTop comes from the safe-area inset at the call site.
  },
  // Same toolbar treatment as the capture screen it opens from: quiet Karla
  // chrome paired with Cancel, so the two sheets share one vocabulary.
  title: { fontFamily: font.medium, fontSize: type.label, color: color.inkMuted },
  search: { paddingHorizontal: space.lg, paddingBottom: space.md },
  // Book-chapter headings, matching the Milestones screen.
  sectionHeader: {
    fontFamily: font.serifItalic,
    fontSize: type.title,
    color: color.damson,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    ...hairline,
  },
  rowTitle: { fontFamily: font.medium, fontSize: type.body, color: color.ink, flex: 1 },
  empty: {
    fontFamily: font.body,
    fontSize: type.body,
    color: color.inkMuted,
    padding: space.xl,
    textAlign: 'center',
  },
});
