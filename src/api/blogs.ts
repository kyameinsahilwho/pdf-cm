import { BLOG_POSTS, type BlogPost } from '@/lib/blogs-data';

export interface BlogFilters {
  category?: 'all' | 'guide' | 'comparison';
  search?: string;
}

const API_SIMULATED_DELAY_MS = 60;

/**
 * Asynchronously fetch blog posts with optional filtering by category or search term.
 * Simulates SSR or REST/GraphQL API retrieval.
 */
export async function fetchBlogPosts(filters?: BlogFilters): Promise<BlogPost[]> {
  // Simulate network latency (0ms in SSR, short delay in browser)
  if (typeof window !== 'undefined') {
    await new Promise((resolve) => setTimeout(resolve, API_SIMULATED_DELAY_MS));
  }

  let posts = [...BLOG_POSTS];

  if (filters?.category && filters.category !== 'all') {
    posts = posts.filter((post) => post.category === filters.category);
  }

  if (filters?.search && filters.search.trim() !== '') {
    const term = filters.search.toLowerCase().trim();
    posts = posts.filter(
      (post) =>
        post.title.toLowerCase().includes(term) ||
        post.excerpt.toLowerCase().includes(term) ||
        post.tags.some((t) => t.toLowerCase().includes(term))
    );
  }

  return posts;
}

/**
 * Asynchronously fetch a single blog post by its URL slug.
 */
export async function fetchBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  if (typeof window !== 'undefined') {
    await new Promise((resolve) => setTimeout(resolve, API_SIMULATED_DELAY_MS));
  }

  const post = BLOG_POSTS.find((p) => p.slug === slug);
  return post || null;
}
