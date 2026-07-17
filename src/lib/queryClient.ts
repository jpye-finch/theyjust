import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data changes only when this family writes, so a short stale window
      // avoids refetch storms while keeping co-parent edits reasonably fresh.
      staleTime: 30_000,
    },
  },
});
