import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextButton } from '@/components/TextButton';
import { childAge, formatChildAge } from '@/features/children/age';
import { useChildren } from '@/features/children/queries';
import { deleteAccount } from '@/features/family/deleteAccount';
import { exportEverything } from '@/features/family/exportData';
import { useNotificationCadence } from '@/features/notifications/notificationSettings';
import type { NotificationCadence } from '@/features/notifications/notificationPlan';
import { confirmDestructive, notify } from '@/lib/dialog';
import { supabase } from '@/lib/supabase';
import { color, font, hairline, space, type } from '@/theme/tokens';

export default function FamilyScreen() {
  const router = useRouter();
  const { data: children = [], isPending } = useChildren();
  const [exporting, setExporting] = useState(false);
  const { cadence, setCadence } = useNotificationCadence();
  const insets = useSafeAreaInsets();

  // The form lives in a sheet now, so the mode bookkeeping that kept add and
  // edit from both being open at once went with it: the route IS the state, and
  // a fresh mount per open means no stale field values or mutation errors to
  // reset. Editing passes the id; adding passes nothing.
  const openAdd = () => router.push('/child');
  const openEdit = (id: string) => router.push({ pathname: '/child', params: { childId: id } });

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

  return (
    <FlatList
      style={styles.list}
      data={children}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={
        <Text style={[styles.heading, { paddingTop: insets.top + space.md }]} accessibilityRole="header">
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
          <TextButton label="Edit" onPress={() => openEdit(item.id)} />
        </View>
      )}
      ListFooterComponent={
        <View style={styles.footer}>
          {/* A family with no children used to get the add form inline and
              permanently, with no way out of it. Now the form is a sheet, so
              the empty case needs its own invitation rather than a form the
              parent never asked to open. */}
          {children.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyLine}>Start with whoever you are here for.</Text>
              <TextButton label="Add your first child" onPress={openAdd} />
            </View>
          ) : (
            <TextButton label="Add another child" onPress={openAdd} />
          )}
          {/* expo-notifications cannot schedule on web, so the row is absent
              there rather than present and inert. */}
          {Platform.OS !== 'web' ? (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>Reminders</Text>
              <Text style={styles.blurb}>
                A quiet note when your little one turns a month older, or when something you saved a
                few months ago comes round again.
              </Text>
              <View style={styles.cadenceRow}>
                {(['weekly', 'monthly', 'off'] as NotificationCadence[]).map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setCadence(option)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: cadence === option }}
                    accessibilityLabel={`Remind me ${option}`}
                    style={[styles.cadence, cadence === option && styles.cadenceActive]}
                  >
                    <Text style={cadence === option ? styles.cadenceTextActive : styles.cadenceText}>
                      {option === 'weekly' ? 'Weekly' : option === 'monthly' ? 'Monthly' : 'Off'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
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
    // Matches the ChildSwitcher heading on Timeline and Milestones.
    fontSize: type.display,
    color: color.ink,
    letterSpacing: -0.5,
    paddingHorizontal: space.lg,
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
  empty: { gap: space.sm },
  emptyLine: { fontFamily: font.body, fontSize: type.body, color: color.inkMuted, lineHeight: 24 },
  section: { gap: space.sm, paddingTop: space.xl, paddingBottom: space.lg, ...hairline },
  // Karla, not Fraunces: settings are functional chrome, and the celebration
  // voice on this screen belongs to the children's names.
  sectionHeading: { fontFamily: font.medium, fontSize: type.title, color: color.ink },
  blurb: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted, lineHeight: 21 },
  cadenceRow: { flexDirection: 'row', gap: space.xl, marginTop: space.xs },
  // Selection is an underline, never a pill (DESIGN.md).
  cadence: { paddingBottom: space.xs, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  cadenceActive: { borderBottomColor: color.damson },
  cadenceText: { fontFamily: font.medium, fontSize: type.label, color: color.inkMuted },
  cadenceTextActive: { fontFamily: font.medium, fontSize: type.label, color: color.damson },
  signOut: { marginTop: space.lg, paddingTop: space.lg },
});
