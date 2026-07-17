import { AppState } from 'react-native';
import { focusManager, QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data changes only when this family writes, so a short stale window
      // avoids refetch storms. Refresh-on-foreground works because we wire
      // AppState into focusManager below (TanStack's DOM listeners are inert
      // on native).
      staleTime: 30_000,
    },
  },
});

// TanStack's documented React Native pattern: report foreground/background so
// refetchOnWindowFocus fires when the app becomes active.
AppState.addEventListener('change', (status) => {
  focusManager.setFocused(status === 'active');
});
