import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextButton } from '@/components/TextButton';
import { ChildForm } from '@/features/children/ChildForm';
import { useChildren, useCreateChild, useUpdateChild } from '@/features/children/queries';
import { color, font, space, type } from '@/theme/tokens';

export default function ChildScreen() {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const { data: children = [], isPending } = useChildren();
  const createChild = useCreateChild();
  const updateChild = useUpdateChild();

  // Adding and editing are the same act, so they are the same screen — the same
  // reasoning that put capture and edit-a-moment behind one route.
  const editing = childId ? children.find((c) => c.id === childId) : undefined;

  // A cold deep-link to ?childId= arrives before the list has loaded. Falling
  // through to the add form here would quietly create a SECOND child instead of
  // editing the one that was asked for.
  if (childId && !editing) {
    return (
      <View style={styles.screen}>
        {isPending ? null : (
          <>
            <Text style={styles.title}>This child is no longer here.</Text>
            <TextButton label="Back to Family" onPress={() => router.replace('/family')} />
          </>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>{editing ? `Edit ${editing.name}` : 'Add a child'}</Text>
        <TextButton label="Cancel" onPress={() => router.back()} tone="muted" />
      </View>
      <ChildForm
        submitLabel={editing ? 'Save' : 'Add child'}
        busy={editing ? updateChild.isPending : createChild.isPending}
        error={(editing ? updateChild.error : createChild.error)?.message ?? null}
        initial={
          editing
            ? {
                name: editing.name,
                dateOfBirth: editing.date_of_birth,
                dueDate: editing.due_date,
              }
            : undefined
        }
        onSubmit={(input) => {
          if (editing) {
            updateChild.mutate({ id: editing.id, input }, { onSuccess: () => router.back() });
            return;
          }
          createChild.mutate(input, { onSuccess: () => router.back() });
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  content: { padding: space.lg, gap: space.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Karla and muted, matching capture: sheet chrome recedes so the fields lead.
  screenTitle: { fontFamily: font.medium, fontSize: type.label, color: color.inkMuted },
  title: { fontFamily: font.displayBold, fontSize: type.display, color: color.ink, letterSpacing: -0.3 },
});
