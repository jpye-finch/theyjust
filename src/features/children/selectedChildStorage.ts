import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'selected-child';

// Which child a parent was last reading. Kept out of the provider so the storage
// contract can be proved on its own, and because the provider must never write:
// only an explicit choice does, or the first hydration would overwrite it with
// whichever child happened to load first.
export function useStoredChildId(): {
  storedId: string | null;
  storeId: (id: string) => void;
} {
  const [storedId, setStoredId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((id) => {
      if (!cancelled && id) setStoredId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const storeId = (id: string) => {
    setStoredId(id);
    // Fire and forget: switching child must not wait on disk to feel instant.
    void AsyncStorage.setItem(STORAGE_KEY, id);
  };

  return { storedId, storeId };
}
