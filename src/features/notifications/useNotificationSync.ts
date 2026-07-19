import { useEffect } from 'react';
import { AppState } from 'react-native';
import { toIsoDate } from '@/lib/date';
import type { Child } from '../children/queries';
import type { Moment } from '../moments/momentQueries';
import { planNotifications, type NotificationCadence } from './notificationPlan';
import { applyNotificationPlan } from './scheduler';

/**
 * Rebuilds the schedule whenever anything it depends on changes: the cadence,
 * the children, their moments, or the app coming back to the foreground (which
 * also covers the day simply having changed while the app sat open).
 */
export function useNotificationSync(
  children: Child[],
  momentsByChild: Record<string, Moment[]>,
  cadence: NotificationCadence,
): void {
  useEffect(() => {
    const rebuild = () => {
      void applyNotificationPlan(
        planNotifications({
          today: toIsoDate(new Date()),
          children,
          momentsByChild,
          cadence,
        }),
      );
    };

    rebuild();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') rebuild();
    });
    return () => subscription.remove();
  }, [children, momentsByChild, cadence]);
}
