import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, font, space, type } from '@/theme/tokens';
import type { TimelineView } from './timelineView';

type Props = {
  childName: string;
  view: TimelineView;
  onSelectView: (next: TimelineView) => void;
  onCapture: () => void;
};

export function TimelineHeader({ childName, view, onSelectView, onCapture }: Props) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>TheyJust</Text>
        <Text style={styles.childLine}>{`${childName}'s story`}</Text>
      </View>
      <View style={styles.actions}>
        {/* Selection is an underline, not a chip: DESIGN.md rules out pills. */}
        <Pressable
          onPress={() => onSelectView('list')}
          accessibilityRole="button"
          accessibilityLabel="List view"
          style={[styles.toggle, view === 'list' && styles.toggleActive]}
        >
          <Feather name="list" size={18} color={view === 'list' ? color.damson : color.inkMuted} />
        </Pressable>
        <Pressable
          onPress={() => onSelectView('spine')}
          accessibilityRole="button"
          accessibilityLabel="Timeline view"
          style={[styles.toggle, view === 'spine' && styles.toggleActive]}
        >
          {/* git-commit is a line with a node on it — the view it selects. */}
          <Feather
            name="git-commit"
            size={18}
            color={view === 'spine' ? color.damson : color.inkMuted}
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
  brand: { fontFamily: font.displayBold, fontSize: type.display, color: color.ink, letterSpacing: -0.5 },
  childLine: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  toggle: {
    paddingHorizontal: space.xs,
    paddingBottom: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  toggleActive: { borderBottomColor: color.damson },
  add: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.damson,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: space.sm,
  },
});
