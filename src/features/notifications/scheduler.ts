import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { PlannedNotification } from './notificationPlan';

// Android drops every notification in silence if no channel exists — no error,
// nothing delivered. Default importance so a parent can quieten or mute this in
// system settings without having to disable the app.
const ANDROID_CHANNEL_ID = 'moments';

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Moments and anniversaries',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Ask for permission. Alert and sound, but deliberately no badge: an unread
 * count on the app icon is a small pressure mechanic, and the wrong tone here.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return status === 'granted';
}

export async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Cancel everything and reschedule from the plan. The plan is deterministic
 * given its inputs, so rebuilding wholesale is both the simplest and the safest
 * thing to do — there is no partial state to reconcile.
 */
export async function applyNotificationPlan(plan: PlannedNotification[]): Promise<void> {
  // expo-notifications cannot schedule on web. Web is a development surface
  // here, so the feature is absent rather than broken: no throw, no prompt.
  if (Platform.OS === 'web') return;

  await ensureAndroidChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!(await hasNotificationPermission())) return;

  for (const notification of plan) {
    const [year, month, day] = notification.fireOn.split('-').map(Number);
    await Notifications.scheduleNotificationAsync({
      identifier: notification.key,
      content: {
        title: notification.title,
        body: notification.body,
        data: { childId: notification.childId, momentId: notification.momentId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        // Local time: 19:30 where the parent is, not where the server is.
        date: new Date(year, month - 1, day, notification.fireAtHour, notification.fireAtMinute),
        channelId: ANDROID_CHANNEL_ID,
      },
    });
  }
}
