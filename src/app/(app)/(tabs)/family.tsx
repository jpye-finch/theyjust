import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { TextButton } from '@/components/TextButton';
import { childAge, formatChildAge } from '@/features/children/age';
import { ChildForm } from '@/features/children/ChildForm';
import { useChildren, useCreateChild, useUpdateChild } from '@/features/children/queries';
import { deleteAccount } from '@/features/family/deleteAccount';
import { exportEverything } from '@/features/family/exportData';
import { confirmDestructive, notify } from '@/lib/dialog';
import { supabase } from '@/lib/supabase';
import { color, font, hairline, space, type } from '@/theme/tokens';

// One source of truth for the footer form. Two independent booleans could both
// be true (add + edit), stranding the user; a single mode makes every state
// reachable exactly one way.
type FormMode = { type: 'idle' } | { type: 'adding' } | { type: 'editing'; id: string };

export default function FamilyScreen() {
  const { data: children = [], isPending } = useChildren();
  const createChild = useCreateChild();
  const updateChild = useUpdateChild();
  const [mode, setMode] = useState<FormMode>({ type: 'idle' });
  const [exporting, setExporting] = useState(false);

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

  // Alert.alert is a silent no-op on react-native-web, so this confirm never
  // appeared there and Sign out simply did nothing.
  const confirmSignOut = () =>
    confirmDestructive('Sign out?', 'You can sign back in any time.', 'Sign out', () => {
      void supabase.auth.signOut();
    });

  const runExport = async () => {
    setExporting(true);
    try {
      await exportEverything(new Date().toISOString());
    } catch (e) {
      notify('Could not export', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const confirmDelete = () =>
    confirmDestructive(
      'Delete your account?',
      'Every moment and photo is erased for good. This cannot be undone.',
      'Delete',
      () => {
        deleteAccount().catch((e) =>
          notify('Could not delete', e instanceof Error ? e.message : 'Please try again.'),
        );
      },
    );

  // Gate on load so a returning parent never flashes the empty-family add form
  // (and never loses typing when the real list arrives).
  if (isPending) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={color.damson} />
      </View>
    );
  }

  const editing = mode.type === 'editing' ? children.find((c) => c.id === mode.id) ?? null : null;
  // A family with no children always shows the add form (and no cancel).
  const showAdd = mode.type === 'adding' || children.length === 0;

  return (
    <FlatList
      style={styles.list}
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
          <TextButton label="Edit" onPress={() => startEditing(item.id)} />
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
              <TextButton label="Cancel" onPress={closeForm} tone="muted" />
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
              {children.length > 0 ? (
                <TextButton label="Cancel" onPress={closeForm} tone="muted" />
              ) : null}
            </View>
          ) : (
            <TextButton label="Add another child" onPress={startAdding} />
          )}
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Your data</Text>
            <Text style={styles.blurb}>
              Take a copy whenever you like: every moment as JSON, with the photos beside it.
            </Text>
            <TextButton
              label={exporting ? 'Preparing your export…' : 'Export everything'}
              onPress={runExport}
            />
            <TextButton label="Delete my account" onPress={confirmDelete} tone="muted" />
          </View>
          <View style={styles.signOut}>
            <TextButton label="Sign out" onPress={confirmSignOut} tone="muted" />
          </View>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: color.paper },
  loading: { flex: 1, justifyContent: 'center', backgroundColor: color.paper },
  heading: {
    fontFamily: font.displayBold,
    fontSize: type.hero,
    color: color.ink,
    letterSpacing: -0.5,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.md,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.rule,
  },
  childInfo: { gap: space.xs },
  childName: { fontFamily: font.display, fontSize: type.title, color: color.ink },
  childAge: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted },
  footer: { padding: space.lg, gap: space.lg },
  form: { gap: space.lg },
  formTitle: { fontFamily: font.display, fontSize: type.title, color: color.ink },
  section: { gap: space.sm, paddingTop: space.xl, paddingBottom: space.lg, ...hairline },
  // Karla, not Fraunces: settings are functional chrome, and the celebration
  // voice on this screen belongs to the children's names.
  sectionHeading: { fontFamily: font.medium, fontSize: type.title, color: color.ink },
  blurb: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted, lineHeight: 21 },
  signOut: { marginTop: space.lg, paddingTop: space.lg },
});
