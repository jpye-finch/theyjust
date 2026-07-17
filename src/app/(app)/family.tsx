import { useState } from 'react';
import { Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { childAge, formatChildAge } from '@/features/children/age';
import { ChildForm } from '@/features/children/ChildForm';
import { useChildren, useCreateChild, useUpdateChild } from '@/features/children/queries';
import { supabase } from '@/lib/supabase';

export default function FamilyScreen() {
  const { data: children = [] } = useChildren();
  const createChild = useCreateChild();
  const updateChild = useUpdateChild();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const editing = children.find((c) => c.id === editingId) ?? null;

  return (
    <FlatList
      data={children}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={<Text style={styles.heading}>Your family</Text>}
      renderItem={({ item }) => (
        <View style={styles.childRow}>
          <View style={styles.childInfo}>
            <Text style={styles.childName}>{item.name}</Text>
            <Text style={styles.childAge}>
              {formatChildAge(childAge(item.date_of_birth, item.due_date, new Date()))}
            </Text>
          </View>
          <Button title="Edit" onPress={() => setEditingId(item.id)} />
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
                  updateChild.mutate(
                    { id: editing.id, input },
                    { onSuccess: () => setEditingId(null) },
                  )
                }
              />
              <Button title="Cancel" onPress={() => setEditingId(null)} />
            </View>
          ) : adding || children.length === 0 ? (
            <View style={styles.form}>
              <Text style={styles.formTitle}>Add a child</Text>
              <ChildForm
                submitLabel="Add child"
                busy={createChild.isPending}
                error={createChild.error?.message ?? null}
                onSubmit={(input) => createChild.mutate(input, { onSuccess: () => setAdding(false) })}
              />
              {children.length > 0 ? (
                <Button title="Cancel" onPress={() => setAdding(false)} />
              ) : null}
            </View>
          ) : (
            <Button title="Add another child" onPress={() => setAdding(true)} />
          )}
          <View style={styles.signOut}>
            <Button title="Sign out" onPress={() => supabase.auth.signOut()} />
          </View>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
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
