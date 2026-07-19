import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { color, font, hairline, radius, space, type } from '@/theme/tokens';
import { childAge, formatChildAge } from './age';
import type { Child } from './queries';

type Props = {
  childrenList: Child[];
  selected: Child;
  onSelect: (id: string) => void;
  onAddChild: () => void;
};

// The child's name IS the celebration voice (DESIGN.md), so it is Fraunces and it
// leads the screen. It replaced the wordmark: you know which app you are in, and
// whose story you are reading is the thing actually worth saying.
export function ChildSwitcher({ childrenList, selected, onSelect, onAddChild }: Props) {
  const [open, setOpen] = useState(false);
  const ageOf = (child: Child) =>
    formatChildAge(childAge(child.date_of_birth, child.due_date, new Date()));

  return (
    // Shrinkable, so a long name ellipsizes rather than shoving the header's
    // buttons off the edge of a phone.
    <View style={styles.root}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${selected.name}. Switch child`}
        accessibilityState={{ expanded: open }}
      >
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {selected.name}
          </Text>
          <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={color.inkMuted} />
        </View>
        {/* The age, not "'s story": it is the frame everything else is read
            against, and it is already computed. Corrected age shows here too. */}
        <Text style={styles.age}>{ageOf(selected)}</Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="fade"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {/* Stop a tap inside the sheet from closing it. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView>
              {childrenList.map((child) => {
                const isSelected = child.id === selected.id;
                return (
                  <Pressable
                    key={child.id}
                    style={styles.item}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Show ${child.name}`}
                    onPress={() => {
                      onSelect(child.id);
                      setOpen(false);
                    }}
                  >
                    <Text style={isSelected ? styles.itemNameSelected : styles.itemName}>
                      {child.name}
                    </Text>
                    <Text style={styles.itemAge}>{ageOf(child)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              style={styles.add}
              accessibilityRole="button"
              onPress={() => {
                setOpen(false);
                onAddChild();
              }}
            >
              <Text style={styles.addText}>Add another child</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexShrink: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  // One size on every screen — Timeline used to run smaller than Milestones and
  // Family, so moving between tabs made the same heading jump. display rather
  // than hero: 34 crowded the header's buttons, and the scale has no step
  // between them worth inventing (DESIGN.md wants ≥1.25 between sizes).
  name: {
    flexShrink: 1,
    fontFamily: font.displayBold,
    fontSize: type.display,
    color: color.ink,
    letterSpacing: -0.5,
  },
  age: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(42, 32, 27, 0.35)',
    justifyContent: 'center',
    padding: space.xl,
  },
  sheet: {
    backgroundColor: color.paper,
    borderRadius: radius.md,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    ...hairline,
  },
  // Selection is damson, not a tick: the app shows state with colour and rules,
  // never with a chip or a badge.
  itemName: { fontFamily: font.display, fontSize: type.title, color: color.ink },
  itemNameSelected: { fontFamily: font.display, fontSize: type.title, color: color.damson },
  itemAge: { fontFamily: font.body, fontSize: type.caption, color: color.inkMuted },
  add: { paddingHorizontal: space.lg, paddingVertical: space.md },
  addText: { fontFamily: font.medium, fontSize: type.label, color: color.damson },
});
