import { QueryClient, isServer, defaultShouldDehydrateQuery } from '@tanstack/react-query';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes - prevents immediate refetching after SSR hydration
        gcTime: 10 * 60 * 1000,   // 10 minutes cache persistence
        refetchOnWindowFocus: false,
        retry: 1,
      },
      dehydrate: {
        // include pending queries in dehydration if needed
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

/**
 * Returns a per-request QueryClient on the server (SSR) or a singleton QueryClient in the browser.
 * Follows TanStack React Query SSR best practices.
 */
export function getQueryClient(): QueryClient {
  if (isServer) {
    // Server: Always make a new query client per request to avoid cross-request data leaks
    return makeQueryClient();
  } else {
    // Browser: Make a new query client if we don't already have one
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient();
    }
    return browserQueryClient;
  }
}
