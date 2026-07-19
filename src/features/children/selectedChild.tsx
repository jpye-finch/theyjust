import { createContext, ReactNode, useContext } from 'react';
import type { Child } from './queries';
import { useChildren } from './queries';
import { useStoredChildId } from './selectedChildStorage';

type SelectedChildValue = {
  children: Child[];
  selected: Child | null;
  select: (id: string) => void;
  loading: boolean;
};

const SelectedChildContext = createContext<SelectedChildValue | null>(null);

export function SelectedChildProvider({ children: node }: { children: ReactNode }) {
  const { data = [], isPending } = useChildren();
  const { storedId, storeId } = useStoredChildId();
  // A stored id that no longer matches a child — deleted, or belonging to an
  // account since signed out of — falls back to the first rather than leaving
  // the app with no child selected.
  const selected = data.find((c) => c.id === storedId) ?? data[0] ?? null;

  return (
    <SelectedChildContext.Provider
      value={{ children: data, selected, select: storeId, loading: isPending }}
    >
      {node}
    </SelectedChildContext.Provider>
  );
}

export function useSelectedChild(): SelectedChildValue {
  const value = useContext(SelectedChildContext);
  if (!value) throw new Error('useSelectedChild must be used inside SelectedChildProvider');
  return value;
}
