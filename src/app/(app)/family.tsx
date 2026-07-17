import { useState } from 'react';
import { ActivityIndicator, Alert, Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { childAge, formatChildAge } from '@/features/children/age';
import { ChildForm } from '@/features/children/ChildForm';
import { useChildren, useCreateChild, useUpdateChild } from '@/features/children/queries';
import { supabase } from '@/lib/supabase';

// One source of truth for the footer form. Two independent booleans could both
// be true (add + edit), stranding the user; a single mode makes every state
// reachable exactly one way.
type FormMode = { type: 'idle' } | { type: 'adding' } | { type: 'editing'; id: string };

export default function FamilyScreen() {
  const { data: children = [], isPending } = useChildren();
  const createChild = useCreateChild();
  const updateChild = useUpdateChild();
  const [mode, setMode] = useState<FormMode>({ type: 'idle' });

  // Every transition clears stale mutation errors, so a failed save on one
  // child never surfaces on another child's untouched form.
  const startAdding = () => {
    createChild.reset();
    setMode({ type: 'adding' });
  };
  const startEditing = (id: string) => {
    updateChild.reset();
    setMode({ type: 'editing', id });
  };
  const closeForm = () => {
    createChild.reset();
    updateChild.reset();
    setMode({ type: 'idle' });
  };

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);

  // Gate on load so a returning parent never flashes the empty-family add form
  // (and never loses typing when the real list arrives).
  if (isPending) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  const editing = mode.type === 'editing' ? children.find((c) => c.id === mode.id) ?? null : null;
  // A family with no children always shows the add form (and no cancel).
  const showAdd = mode.type === 'adding' || children.length === 0;

  return (
    <FlatList
      data={children}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={
        <Text style={styles.heading} accessibilityRole="header">
          Your family
        </Text>
      }
      renderItem={({ item }) => (
        <View style={styles.childRow}>
          <View style={styles.childInfo}>
            <Text style={styles.childName}>{item.name}</Text>
            <Text style={styles.childAge}>
              {formatChildAge(childAge(item.date_of_birth, item.due_date, new Date()))}
            </Text>
          </View>
          <Button title="Edit" onPress={() => startEditing(item.id)} />
        </View>
      )}
      ListFooterComponent={
        <View style={styles.footer}>
          {editing ? (
            <View style={styles.form}>
              <Text style={styles.formTitle}>{`Edit ${editing.name}`}</Text>
              {/* key forces a remount when the edit target changes — without it,
                  switching from editing child A to child B keeps A's field state
                  and Save would overwrite B with A's values. */}
              <ChildForm
                key={editing.id}
                submitLabel="Save"
                busy={updateChild.isPending}
                error={updateChild.error?.message ?? null}
                initial={{
                  name: editing.name,
                  dateOfBirth: editing.date_of_birth,
                  dueDate: editing.due_date,
                }}
                onSubmit={(input) =>
                  updateChild.mutate({ id: editing.id, input }, { onSuccess: closeForm })
                }
              />
              <Button title="Cancel" onPress={closeForm} />
            </View>
          ) : showAdd ? (
            <View style={styles.form}>
              <Text style={styles.formTitle}>Add a child</Text>
              <ChildForm
                submitLabel="Add child"
                busy={createChild.isPending}
                error={createChild.error?.message ?? null}
                onSubmit={(input) => createChild.mutate(input, { onSuccess: closeForm })}
              />
              {children.length > 0 ? <Button title="Cancel" onPress={closeForm} /> : null}
            </View>
          ) : (
            <Button title="Add another child" onPress={startAdding} />
          )}
          <View style={styles.signOut}>
            <Button title="Sign out" onPress={confirmSignOut} />
          </View>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center' },
  heading: { fontSize: 24, fontWeight: '800', padding: 16 },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  childInfo: { gap: 2 },
  childName: { fontSize: 17, fontWeight: '600' },
  childAge: { fontSize: 14, color: '#555' },
  footer: { padding: 16, gap: 16 },
  form: { gap: 12 },
  formTitle: { fontSize: 18, fontWeight: '700' },
  signOut: { marginTop: 24 },
});
