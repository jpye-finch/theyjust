import { useRouter } from 'expo-router';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { childAge } from '@/features/children/age';
import { ChildSwitcher } from '@/features/children/ChildSwitcher';
import { useSelectedChild } from '@/features/children/selectedChild';
import { achievedAgeTexts, useMomentSummaries } from '@/features/milestones/achievements';
import { CATALOGUE, CATEGORY_LABELS, MilestoneCategory } from '@/features/milestones/catalogue';
import { MilestoneRow } from '@/features/milestones/MilestoneRow';
import { color, font, space, type } from '@/theme/tokens';

// Grouping the static catalogue by category depends on nothing per-render, so
// compute it once at import rather than on every render / chip tap.
const SECTIONS = (Object.keys(CATEGORY_LABELS) as MilestoneCategory[]).map((category) => ({
  title: CATEGORY_LABELS[category],
  data: CATALOGUE.filter((e) => e.category === category),
}));

export default function MilestonesScreen() {
  const router = useRouter();
  const { children, selected, select, loading } = useSelectedChild();
  const { data: moments = [] } = useMomentSummaries(selected?.id ?? null);

  if (loading) return null;

  if (!selected) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Who are we celebrating?</Text>
        <Text style={styles.emptyBody}>Add your little one to start their story.</Text>
        <View style={styles.emptyButton}>
          <PrimaryButton label="Add your child" onPress={() => router.push('/family')} />
        </View>
      </View>
    );
  }

  const age = childAge(selected.date_of_birth, selected.due_date, new Date());
  const achieved = achievedAgeTexts(moments, selected.date_of_birth);

  return (
    <SectionList
      style={styles.list}
      sections={SECTIONS}
      keyExtractor={(e) => e.id}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <View style={styles.header}>
          {/* The same switcher as the Timeline header: one way to change child,
              in the same place on both screens. It replaced a chip row that did
              the same job in a different idiom, plus a name and age it repeated. */}
          <ChildSwitcher
            childrenList={children}
            selected={selected}
            onSelect={select}
            onAddChild={() => router.push('/family')}
            size="hero"
          />
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <Pressable
          onPress={
            achieved[item.id]
              ? undefined
              : () => router.push({ pathname: '/capture', params: { milestoneId: item.id } })
          }
          disabled={!!achieved[item.id]}
          accessibilityRole={achieved[item.id] ? undefined : 'button'}
          accessibilityLabel={achieved[item.id] ? item.title : `Log ${item.title}`}
        >
          <MilestoneRow
            entry={item}
            comparisonMonths={age.comparisonMonths}
            achievedAgeText={achieved[item.id] ?? null}
          />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: color.paper },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.xl,
    gap: space.md,
    backgroundColor: color.paper,
  },
  emptyTitle: {
    fontFamily: font.display,
    fontSize: 30,
    color: color.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontFamily: font.body,
    fontSize: type.body,
    color: color.inkMuted,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  emptyButton: { alignSelf: 'stretch', paddingHorizontal: space.xl },
  header: { paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.md, gap: space.xs },
  // A hairline-underline selector (echoes the Field focus motif), not pill chips.
  // Book-chapter headings, not tracked-uppercase SaaS kickers.
  sectionHeader: {
    fontFamily: font.serifItalic,
    fontSize: type.title,
    color: color.damson,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.sm,
    backgroundColor: color.paper,
  },
});
