import { useRouter } from 'expo-router';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const { data: moments = [] } = useMomentSummaries(selected?.id ?? null);

  if (loading) return null;

  if (!selected) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Who are we celebrating?</Text>
        <Text style={styles.emptyBody}>Add your little one to start their story.</Text>
        <View style={styles.emptyButton}>
          <PrimaryButton label="Add your child" onPress={() => router.push('/child')} />
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
        <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
          {/* The same switcher as the Timeline header: one way to change child,
              in the same place on both screens. It replaced a chip row that did
              the same job in a different idiom, plus a name and age it repeated. */}
          <ChildSwitcher
            childrenList={children}
            selected={selected}
            onSelect={select}
            onAddChild={() => router.push('/child')}
          />
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      ListFooterComponent={
        // A footnote, the way a book sources its plates: said once, at the end,
        // rather than repeated under every row a child has passed — which for an
        // older child meant the same worried sentence a dozen times down a screen.
        <Text style={styles.note}>
          These ranges come from WHO, CDC and NHS guidance, and every one is drawn from at least two
          of them. They describe when something usually appears, not when it should: children arrive
          in their own order, and some skip a milestone altogether. If anything is worrying you,
          your child’s doctor or health visitor is the right person to ask.
        </Text>
      }
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
          <MilestoneRow entry={item} achievedAgeText={achieved[item.id] ?? null} />
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
  header: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.xs },
  // Karla and muted: the quiet voice that sources the list, not part of the
  // celebration. A hairline above sets it apart from the last milestone.
  note: {
    fontFamily: font.body,
    fontSize: type.caption,
    color: color.inkMuted,
    lineHeight: 20,
    marginHorizontal: space.lg,
    marginTop: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
    borderTopWidth: 1,
    borderTopColor: color.rule,
  },
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
