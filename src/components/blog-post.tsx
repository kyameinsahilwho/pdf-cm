import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Header } from './header';
import { MarkdownRenderer } from './markdown-renderer';
import { BLOG_POSTS } from '@/lib/blogs-data';
import { TOOL_REGISTRY } from '@/lib/tools-data';
import { Clock, Calendar, User, ArrowLeft, ExternalLink, Zap, ShieldCheck, CheckCircle2 } from 'lucide-react';

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = BLOG_POSTS.find((p) => p.slug === slug);

  if (!post) {
    return <Navigate to="/404" replace />;
  }

  const relatedTools = TOOL_REGISTRY.filter((t) => post.relatedToolSlugs.includes(t.slug));

  return (
    <div className="app-shell min-h-screen">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Breadcrumb Navigation */}
        <div className="flex items-center justify-between">
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 font-mono transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Articles</span>
          </Link>

          <span className="text-xs font-mono text-slate-500 uppercase px-2 py-0.5 rounded bg-white/[0.04]">
            {post.category}
          </span>
        </div>

        {/* Article Header */}
        <div className="space-y-4 border-b border-white/[0.08] pb-6">
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono pt-2">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-500" />
              {post.author}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              {post.publishedAt}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {post.readTime}
            </span>
          </div>
        </div>

        {/* Article Body */}
        <article className="bg-[#131520]/60 border border-white/[0.08] p-6 sm:p-8 rounded-2xl">
          <MarkdownRenderer content={post.content} />
        </article>

        {/* Embedded Tool CTA Widgets */}
        {relatedTools.length > 0 && (
          <div className="bg-[#131520] border border-amber-500/30 p-6 rounded-2xl space-y-4 mt-8 shadow-2xl">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">Try Recommended PDF Tools Now</h3>
            </div>
            <p className="text-xs text-slate-400">
              Launch these tools directly in your browser with zero server storage and 100% privacy:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {relatedTools.map((tool) => (
                <Link
                  key={tool.id}
                  to={`/${tool.slug}`}
                  className="bg-[#090a0f] border border-white/[0.08] hover:border-amber-500/50 p-3.5 rounded-xl flex items-center justify-between group transition-all"
                >
                  <div>
                    <div className="font-semibold text-white text-xs group-hover:text-amber-400 transition-colors">
                      {tool.name}
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-1">{tool.desc}</div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors shrink-0 ml-2" />
                </Link>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
