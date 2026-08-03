import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from './header';
import { TOOL_REGISTRY, CATEGORIES } from '@/lib/tools-data';
import { BLOG_POSTS } from '@/lib/blogs-data';
import { Map, FileText, Search, ExternalLink, Code, Layers } from 'lucide-react';

export function SitemapPage() {
  const [search, setSearch] = useState('');
  const [viewXmlMode, setViewXmlMode] = useState(false);

  const filteredTools = TOOL_REGISTRY.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.desc.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
  );

  const filteredBlogs = BLOG_POSTS.filter(
    (b) =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.excerpt.toLowerCase().includes(search.toLowerCase()) ||
      b.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
  );

  const xmlSitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://codingmarvel.com/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://codingmarvel.com/sitemap</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://codingmarvel.com/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
${TOOL_REGISTRY.map(
  (t) => `  <url>
    <loc>https://codingmarvel.com/${t.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`
).join('\n')}
${BLOG_POSTS.map(
  (b) => `  <url>
    <loc>https://codingmarvel.com/blog/${b.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
).join('\n')}
</urlset>`;

  return (
    <div className="app-shell min-h-screen">
      <Header />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Header Hero */}
        <div className="bg-[#131520] border border-white/[0.08] p-6 sm:p-8 rounded-2xl relative overflow-hidden space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono mb-2">
                <Map className="w-3.5 h-3.5" />
                <span>INDEX & DIRECTORY</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Love for PDF — Complete Sitemap
              </h1>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                Explore all 30+ browser-based PDF tools, category guides, and comparison articles in one organized directory.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewXmlMode(!viewXmlMode)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-mono text-slate-200 transition-colors"
              >
                <Code className="w-4 h-4 text-amber-400" />
                <span>{viewXmlMode ? 'View Visual Sitemap' : 'View XML Format'}</span>
              </button>
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-mono text-amber-400 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>sitemap.xml</span>
              </a>
            </div>
          </div>

          {/* Search filter */}
          <div className="relative max-w-md pt-2">
            <Search className="w-4 h-4 absolute left-3 top-5 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all tools and articles in sitemap..."
              className="w-full bg-[#090a0f] border border-white/[0.1] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50"
            />
          </div>
        </div>

        {viewXmlMode ? (
          /* XML View Mode */
          <div className="bg-[#090a0f] border border-white/[0.08] p-6 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-mono font-bold text-amber-400">sitemap.xml (SEO Engine View)</h3>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(xmlSitemapContent)}
                className="text-xs text-slate-400 hover:text-white font-mono underline"
              >
                Copy XML Content
              </button>
            </div>
            <pre className="text-xs font-mono text-emerald-400 bg-black/50 p-4 rounded-xl overflow-x-auto max-h-[500px]">
              {xmlSitemapContent}
            </pre>
          </div>
        ) : (
          /* Visual HTML Sitemap View Mode */
          <div className="space-y-10">

            {/* 1. Categorized Tools Section */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-white/[0.08] pb-3">
                <Layers className="w-5 h-5 text-rose-400" />
                <span>PDF Tools Directory</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {CATEGORIES.filter((c) => c.id !== 'all').map((cat) => {
                  const categoryTools = filteredTools.filter((t) => t.category === cat.id);
                  if (categoryTools.length === 0) return null;

                  return (
                    <div
                      key={cat.id}
                      className="bg-[#131520]/80 border border-white/[0.08] p-5 rounded-2xl space-y-3 hover:border-white/[0.15] transition-colors"
                    >
                      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                        <span className="text-lg">{cat.icon}</span>
                        <h3 className="font-semibold text-white text-sm">{cat.label}</h3>
                        <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300">
                          {categoryTools.length} tools
                        </span>
                      </div>

                      <ul className="space-y-2">
                        {categoryTools.map((tool) => (
                          <li key={tool.id}>
                            <Link
                              to={`/${tool.slug}`}
                              className="group flex items-center justify-between text-xs text-slate-300 hover:text-rose-400 transition-colors py-1"
                            >
                              <span className="font-medium">{tool.name}</span>
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 group-hover:text-rose-400" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Blog & Guides Section */}
            <div className="space-y-6 pt-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-white/[0.08] pb-3">
                <FileText className="w-5 h-5 text-amber-400" />
                <span>Blog Articles & Competitor Comparisons</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredBlogs.map((post) => (
                  <Link
                    key={post.slug}
                    to={`/blog/${post.slug}`}
                    className="bg-[#131520]/80 border border-white/[0.08] p-4 rounded-xl hover:border-amber-500/40 transition-colors flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-md uppercase ${
                            post.category === 'comparison'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {post.category}
                        </span>
                        <span className="text-[10px] text-slate-500">{post.readTime}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors">
                        {post.title}
                      </h4>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">{post.excerpt}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
