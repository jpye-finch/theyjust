import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type TimelineView = 'list' | 'spine';

const STORAGE_KEY = 'timeline-view';

// The list is the default: it is the reading view, carrying notes and full
// photos. The spine is the overview a parent opts into.
const DEFAULT_VIEW: TimelineView = 'list';

export function useTimelineView(): {
  view: TimelineView;
  setView: (next: TimelineView) => void;
} {
  const [view, setLocalView] = useState<TimelineView>(DEFAULT_VIEW);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      // Anything unrecognised falls back rather than rendering an unknown view.
      if (!cancelled && (stored === 'list' || stored === 'spine')) setLocalView(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setView = (next: TimelineView) => {
    setLocalView(next);
    // Fire and forget: the toggle must not wait on disk to feel instant.
    void AsyncStorage.setItem(STORAGE_KEY, next);
  };

  return { view, setView };
}
