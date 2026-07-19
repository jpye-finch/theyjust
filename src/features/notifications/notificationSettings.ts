import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import type { NotificationCadence } from './notificationPlan';

const STORAGE_KEY = 'notification-cadence';

// Weekly is enough to keep a memory book in mind, and a memory book that pings
// daily is a different and worse product. There is deliberately no Daily option
// to store: offering it would be offering the setting that does the damage.
const DEFAULT_CADENCE: NotificationCadence = 'weekly';

export function useNotificationCadence(): {
  cadence: NotificationCadence;
  setCadence: (next: NotificationCadence) => void;
} {
  const [cadence, setLocalCadence] = useState<NotificationCadence>(DEFAULT_CADENCE);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (cancelled) return;
      if (stored === 'weekly' || stored === 'monthly' || stored === 'off') setLocalCadence(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setCadence = (next: NotificationCadence) => {
    setLocalCadence(next);
    // Fire and forget: the setting must not wait on disk to feel instant.
    void AsyncStorage.setItem(STORAGE_KEY, next);
  };

  return { cadence, setCadence };
}
