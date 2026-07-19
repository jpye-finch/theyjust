import { useMemo } from 'react';
import { useSelectedChild } from '@/features/children/selectedChild';
import { useFamilyMoments } from '@/features/moments/momentQueries';
import { useNotificationCadence } from './notificationSettings';
import { useNotificationSync } from './useNotificationSync';

const NO_MOMENTS: Record<string, never> = {};

/**
 * Renders nothing. It exists because `useNotificationSync` has to live inside
 * the SelectedChildProvider to see the family, and a layout cannot call a hook
 * that depends on a provider it is itself rendering.
 *
 * Mounted once at the top of the signed-in app, so the schedule is rebuilt
 * wherever the parent happens to be — not only when they visit one screen.
 */
export function NotificationSync(): null {
  const { children } = useSelectedChild();
  const childIds = useMemo(() => children.map((c) => c.id), [children]);
  const { data } = useFamilyMoments(childIds);
  const { cadence } = useNotificationCadence();

  useNotificationSync(children, data ?? NO_MOMENTS, cadence);
  return null;
}
