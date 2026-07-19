import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'notification-permission-asked';

// Asking on first launch is the standard way to lose permission for good: the
// request arrives before the app has shown what it is for, and a refusal is
// final. Three captured moments is enough to have felt the point of it.
const MOMENTS_BEFORE_ASKING = 3;

/**
 * `momentCount` comes from data the app has already loaded — there is no stored
 * counter to drift out of step with the timeline.
 */
export function useNotificationPermission(momentCount: number): {
  shouldAsk: boolean;
  markAsked: () => void;
} {
  const [asked, setAsked] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Assume asked until storage says otherwise, so a slow read can never cause
    // a prompt to flash up on launch.
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!cancelled) setAsked(stored === 'true');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const markAsked = () => {
    setAsked(true);
    void AsyncStorage.setItem(STORAGE_KEY, 'true');
  };

  return { shouldAsk: !asked && momentCount >= MOMENTS_BEFORE_ASKING, markAsked };
}
