import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { HydrationBoundary, type DehydratedState } from '@tanstack/react-query';
import { Header } from './header';
import { useBlogPosts, usePrefetchBlogPost } from '@/hooks/use-blogs';
import { BLOG_POSTS } from '@/lib/blogs-data';
import { useSeoHead } from '@/lib/seo-helper';
import { BookOpen, Search, Clock, ArrowRight, Loader2 } from 'lucide-react';

interface BlogIndexPageProps {
  dehydratedState?: DehydratedState;
}

function BlogIndexContent() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'guide' | 'comparison'>('all');

  const prefetchBlogPost = usePrefetchBlogPost();

  const { data: posts, isLoading, isFetching, isError } = useBlogPosts({
    category: selectedCategory,
    search,
  });

  useSeoHead({
    title: 'PDF Guides & Competitor Comparisons | Love for PDF Blog',
    description: 'Technical guides, security best practices, and honest feature comparisons evaluating Love for PDF against iLovePDF, Smallpdf, Adobe Acrobat, and Sejda.',
    canonicalUrl: 'https://codingmarvel.com/blog',
  });

  return (
    <div className="app-shell min-h-screen">
      <Header />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Blog Hero Header */}
        <div className="bg-[#131520] border border-white/[0.08] p-6 sm:p-10 rounded-2xl relative overflow-hidden space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono">
            <BookOpen className="w-3.5 h-3.5" />
            <span>KNOWLEDGE BASE & GUIDES</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            PDF Tools & Competitor Comparisons
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            In-depth technical guides, security best practices, and honest feature comparisons evaluating Love for PDF against iLovePDF, Smallpdf, Adobe Acrobat, and Sejda.
          </p>

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-white/[0.08]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-amber-500 text-black font-semibold'
                    : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]'
                }`}
              >
                All Articles ({BLOG_POSTS.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('guide')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory === 'guide'
                    ? 'bg-emerald-500 text-black font-semibold'
                    : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]'
                }`}
              >
                Category Guides
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('comparison')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory === 'comparison'
                    ? 'bg-purple-500 text-white font-semibold'
                    : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]'
                }`}
              >
                Competitor Comparisons
              </button>
            </div>

            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter articles by tag or title..."
                className="w-full bg-[#090a0f] border border-white/[0.1] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
              {isFetching && !isLoading && (
                <Loader2 className="w-3.5 h-3.5 absolute right-3 top-3 text-amber-400 animate-spin" />
              )}
            </div>
          </div>
        </div>

        {/* Article Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-[#131520]/80 border border-white/[0.08] rounded-2xl p-6 h-64 animate-pulse space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <div className="h-4 w-20 bg-white/[0.08] rounded" />
                    <div className="h-4 w-12 bg-white/[0.08] rounded" />
                  </div>
                  <div className="h-6 w-3/4 bg-white/[0.1] rounded" />
                  <div className="h-4 w-full bg-white/[0.06] rounded" />
                  <div className="h-4 w-2/3 bg-white/[0.06] rounded" />
                </div>
                <div className="h-4 w-24 bg-white/[0.08] rounded" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-12 text-slate-400 bg-[#131520] rounded-2xl border border-red-500/20 p-6">
            <p className="text-red-400 font-semibold mb-2">Failed to load articles</p>
            <p className="text-xs text-slate-500">Please refresh the page to try again.</p>
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="bg-[#131520]/80 border border-white/[0.08] rounded-2xl p-6 flex flex-col justify-between hover:border-amber-500/40 transition-all group hover:shadow-xl"
                onMouseEnter={() => prefetchBlogPost(post.slug)}
                onFocus={() => prefetchBlogPost(post.slug)}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-md uppercase tracking-wider ${
                        post.category === 'comparison'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {post.category === 'comparison' ? 'VS Competitor' : 'Guide'}
                    </span>

                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{post.readTime}</span>
                    </div>
                  </div>

                  <Link
                    to={`/blog/${post.slug}`}
                    className="block group-hover:text-amber-400 transition-colors"
                  >
                    <h3 className="text-lg font-bold text-white tracking-tight leading-snug">
                      {post.title}
                    </h3>
                  </Link>

                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                    {post.excerpt}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/[0.06] mt-4 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {post.tags.slice(0, 2).map((t) => (
                      <span key={t} className="text-[10px] font-mono text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded">
                        #{t}
                      </span>
                    ))}
                  </div>

                  <Link
                    to={`/blog/${post.slug}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <span>Read Article</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 bg-[#131520] rounded-2xl border border-white/[0.08] p-6">
            <p className="font-semibold text-white mb-1">No articles found</p>
            <p className="text-xs text-slate-500">Try adjusting your category filter or search terms.</p>
          </div>
        )}

      </main>
    </div>
  );
}

export function BlogIndexPage({ dehydratedState }: BlogIndexPageProps) {
  return (
    <HydrationBoundary state={dehydratedState}>
      <BlogIndexContent />
    </HydrationBoundary>
  );
}
