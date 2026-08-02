'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { TOOL_REGISTRY, CATEGORIES, CategoryId } from '@/lib/tools-data';
import { ToolIcon, getToolGradient } from './tool-icon';

export function PdfFusion() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTools = useMemo(() => {
    return TOOL_REGISTRY.filter((t) => {
      const matchCat = activeCategory === 'all' || t.category === activeCategory;
      const matchSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.desc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  return (
    <div className="w-full max-w-6xl mx-auto pb-24 pt-12 px-4 sm:px-6">

      {/* ── HERO SECTION ── */}
      <div className="text-center space-y-4 mb-12 animate-fade-up">

        {/* Eyebrow badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-slate-300">
            Zero Server Storage • Files never leave your browser
          </span>
        </div>

        {/* Headline with Instrument Serif Italic Accent */}
        <h1 className="font-sans-head text-4xl sm:text-5xl font-bold tracking-tight text-white leading-[1.15]">
          Every PDF tool you need.<br />
          <span className="font-serif italic font-normal text-slate-300 text-5xl sm:text-6xl">
            Private, fast, &amp; effortless.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="max-w-lg mx-auto text-sm text-slate-400 leading-relaxed font-sans">
          Merge, split, compress, convert, edit, sign, and automate document workflows
          directly in your browser with complete privacy.
        </p>

        {/* Search Bar */}
        <div className="max-w-lg mx-auto pt-2 relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 35+ tools — Merge, Split, Compress, OCR…"
            className="search-input"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-white bg-white/[0.08] hover:bg-white/[0.15] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex absolute right-3.5 top-1/2 -translate-y-1/2 items-center gap-0.5 font-mono text-[10px] font-medium px-2 py-0.5 rounded bg-white/[0.06] text-slate-400 border border-white/[0.1]">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* ── CATEGORY FILTER TABS ── */}
      <div className="flex flex-wrap items-center gap-1.5 mb-8 pb-3 border-b border-white/[0.06]">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 mr-1">
          {filteredTools.length} {filteredTools.length === 1 ? 'tool' : 'tools'}
        </span>

        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-white/[0.1] text-white border border-white/[0.12] shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* ── TOOL CARDS GRID ── */}
      {filteredTools.length === 0 ? (
        <div className="text-center py-20 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
          <p className="text-base font-medium text-slate-300 mb-1">No matching tools found</p>
          <p className="text-xs text-slate-500">Try searching for keywords like &quot;merge&quot;, &quot;word&quot;, or &quot;ocr&quot;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredTools.map((tool, i) => (
            <Link
              key={tool.id}
              href={`/${tool.slug}`}
              className="tool-card group animate-fade-up"
              style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}
            >
              {/* Header: Icon + Badge */}
              <div className="flex items-start justify-between mb-3.5">
                <div
                  className="tool-icon"
                  style={{ background: getToolGradient(tool.id) }}
                >
                  <ToolIcon iconName={tool.iconName} className="w-5 h-5 text-white" />
                </div>
                {tool.badge && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                      tool.badge === 'AI'
                        ? 'bg-purple-500/10 text-purple-300 border-purple-500/25'
                        : tool.badge === 'POPULAR'
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/25'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                    }`}
                  >
                    {tool.badge}
                  </span>
                )}
              </div>

              {/* Title & Description */}
              <h3 className="font-sans-head text-sm font-semibold text-slate-100 group-hover:text-amber-300 transition-colors duration-150 mb-1">
                {tool.name}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed flex-1 font-sans">
                {tool.desc}
              </p>

              {/* Action Link Footer */}
              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-medium text-slate-400 group-hover:text-amber-300 transition-colors">
                <span>Use tool</span>
                <span className="w-6 h-6 rounded-full bg-white/[0.04] group-hover:bg-amber-500/20 border border-white/[0.08] group-hover:border-amber-500/30 flex items-center justify-center transition-all duration-200">
                  <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all duration-200" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
