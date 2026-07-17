import { createContext, ReactNode, useContext, useState } from 'react';
import type { Child } from './queries';
import { useChildren } from './queries';

type SelectedChildValue = {
  children: Child[];
  selected: Child | null;
  select: (id: string) => void;
  loading: boolean;
};

const SelectedChildContext = createContext<SelectedChildValue | null>(null);

export function SelectedChildProvider({ children: node }: { children: ReactNode }) {
  const { data = [], isPending } = useChildren();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data.find((c) => c.id === selectedId) ?? data[0] ?? null;

  return (
    <SelectedChildContext.Provider
      value={{ children: data, selected, select: setSelectedId, loading: isPending }}
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
