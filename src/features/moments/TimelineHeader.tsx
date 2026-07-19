import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChildSwitcher } from '@/features/children/ChildSwitcher';
import type { Child } from '@/features/children/queries';
import { color, space } from '@/theme/tokens';
import type { TimelineView } from './timelineView';

type Props = {
  childrenList: Child[];
  selected: Child;
  onSelectChild: (id: string) => void;
  onAddChild: () => void;
  view: TimelineView;
  onSelectView: (next: TimelineView) => void;
  onCapture: () => void;
};

export function TimelineHeader({
  childrenList,
  selected,
  onSelectChild,
  onAddChild,
  view,
  onSelectView,
  onCapture,
}: Props) {
  // One button offering the OTHER view, rather than two showing which is active.
  // Two mutually exclusive views need no state control: a list of cards and a
  // spine are unmistakable, so the page already says where you are. The button
  // only has to offer the alternative, which makes it an action, not a state.
  const target: TimelineView = view === 'list' ? 'spine' : 'list';

  return (
    <View style={styles.header}>
      <ChildSwitcher
        childrenList={childrenList}
        selected={selected}
        onSelect={onSelectChild}
        onAddChild={onAddChild}
      />
      <View style={styles.actions}>
        <Pressable
          onPress={() => onSelectView(target)}
          accessibilityRole="button"
          accessibilityLabel={target === 'spine' ? 'Switch to timeline view' : 'Switch to list view'}
          style={styles.toggle}
        >
          {/* git-commit is a line with a node on it — the view it selects. */}
          <Feather
            name={target === 'spine' ? 'git-commit' : 'list'}
            size={20}
            color={color.inkMuted}
          />
        </Pressable>
        <Pressable
          onPress={onCapture}
          accessibilityRole="button"
          accessibilityLabel="Capture a moment"
          style={styles.add}
        >
          {/* A vector glyph centres in its own box; a text "+" sits on the
              maths axis and always reads high inside a circle. */}
          <Feather name="plus" size={22} color={color.onDamson} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.md,
    backgroundColor: color.paper,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  toggle: { padding: space.xs },
  add: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.damson,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
