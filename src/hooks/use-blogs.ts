import { useQuery, useQueryClient, dehydrate, type QueryClient } from '@tanstack/react-query';
import { fetchBlogPosts, fetchBlogPostBySlug, type BlogFilters } from '@/api/blogs';
import type { BlogPost } from '@/lib/blogs-data';

/**
 * Standardized Query Key Factory for Blog resources.
 * Allows structured cache invalidation and query prefetching.
 */
export const blogKeys = {
  all: ['blogs'] as const,
  lists: () => [...blogKeys.all, 'list'] as const,
  list: (filters?: BlogFilters) => [...blogKeys.lists(), filters || {}] as const,
  details: () => [...blogKeys.all, 'detail'] as const,
  detail: (slug: string) => [...blogKeys.details(), slug] as const,
};

/**
 * React Hook to fetch blog posts list with caching & query keys.
 */
export function useBlogPosts(filters?: BlogFilters) {
  return useQuery({
    queryKey: blogKeys.list(filters),
    queryFn: () => fetchBlogPosts(filters),
  });
}

/**
 * React Hook to fetch a single blog post by slug.
 */
export function useBlogPost(slug?: string) {
  return useQuery({
    queryKey: blogKeys.detail(slug || ''),
    queryFn: () => {
      if (!slug) return Promise.resolve(null);
      return fetchBlogPostBySlug(slug);
    },
    enabled: Boolean(slug),
  });
}

/**
 * React Hook providing a function to prefetch a blog post on hover or user intent.
 */
export function usePrefetchBlogPost() {
  const queryClient = useQueryClient();

  return (slug: string) => {
    if (!slug) return;
    queryClient.prefetchQuery({
      queryKey: blogKeys.detail(slug),
      queryFn: () => fetchBlogPostBySlug(slug),
    });
  };
}

/**
 * Server-Side Rendering (SSR) / Prerender Helper:
 * Prefetches blog posts list on the server and returns dehydrated state.
 */
export async function prefetchBlogPosts(queryClient: QueryClient, filters?: BlogFilters) {
  await queryClient.prefetchQuery({
    queryKey: blogKeys.list(filters),
    queryFn: () => fetchBlogPosts(filters),
  });

  return dehydrate(queryClient);
}

/**
 * Server-Side Rendering (SSR) / Prerender Helper:
 * Prefetches a single blog post on the server and returns dehydrated state.
 */
export async function prefetchBlogPost(queryClient: QueryClient, slug: string) {
  await queryClient.prefetchQuery({
    queryKey: blogKeys.detail(slug),
    queryFn: () => fetchBlogPostBySlug(slug),
  });

  return dehydrate(queryClient);
}
