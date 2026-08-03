import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { Link, Navigate, Route, Routes, useParams, useLocation } from 'react-router-dom';
import { Header } from '@/components/header';
import { PdfFusion } from '@/components/pdf-fusion';
import { ToolWorkspace } from '@/components/tool-workspace';
import { SitemapPage } from '@/components/sitemap';
import { BlogIndexPage } from '@/components/blog-index';
import { BlogPostPage } from '@/components/blog-post';
import { Toaster } from './shims/toaster';
import { TOOL_REGISTRY, CATEGORIES, type CategoryId, type ToolDef } from '@/lib/tools-data';
import { getToolSeoContent } from '@/lib/tool-seo';
import { fetchTools } from './api/tools';
import { ShieldCheck, Table as TableIcon, LayoutGrid, FileText, ArrowLeft } from 'lucide-react';

const columnHelper = createColumnHelper<ToolDef>();

const columns = [
  columnHelper.accessor('name', {
    header: 'Tool',
    cell: (info) => (
      <Link to={`/${info.row.original.slug}`} className="font-semibold text-rose-400 hover:text-rose-300">
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor('category', {
    header: 'Category',
    cell: (info) => (
      <span className="capitalize px-2 py-0.5 rounded-full text-xs font-mono bg-white/[0.06] text-slate-300">
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor('badge', {
    header: 'Badge',
    cell: (info) => (
      <span className="text-xs text-amber-400 font-mono font-medium">{info.getValue() ?? '—'}</span>
    ),
  }),
  columnHelper.accessor('accept', {
    header: 'Accepted Files',
    cell: (info) => <span className="text-xs text-slate-400 font-mono">{info.getValue() ?? 'Any'}</span>,
  }),
  columnHelper.accessor('slug', {
    header: 'Route Slug',
    cell: (info) => <span className="text-xs text-slate-500 font-mono">/{info.getValue()}</span>,
  }),
];

function ToolsTanStackTable() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);

  const { data = TOOL_REGISTRY, isLoading, isError } = useQuery({
    queryKey: ['tools'],
    queryFn: fetchTools,
    initialData: TOOL_REGISTRY,
  });

  const filteredTools = useMemo(() => {
    return data.filter((tool) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        tool.name.toLowerCase().includes(query) ||
        tool.desc.toLowerCase().includes(query) ||
        tool.slug.toLowerCase().includes(query);

      const matchesCategory = activeCategory === 'all' || tool.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [data, searchQuery, activeCategory]);

  const table = useReactTable({
    data: filteredTools,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 12,
      },
    },
  });

  return (
    <section className="w-full max-w-6xl mx-auto space-y-6">
      <div className="bg-[#131520]/80 border border-white/[0.08] rounded-2xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <TableIcon className="w-5 h-5 text-rose-400" />
              Table View
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Interactive client-side data table with sorting, search filtering, and pagination.
            </p>
          </div>
          <input
            className="search-input max-w-xs text-xs"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by name, description, slug..."
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.06]">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                activeCategory === category.id
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                  : 'bg-white/[0.03] text-slate-400 hover:text-slate-200 border border-white/[0.06]'
              }`}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap shadow-xl">
        {isLoading ? <div className="p-8 text-center text-sm text-slate-400">Loading tools index...</div> : null}
        {isError ? <div className="p-8 text-center text-sm text-rose-400">Failed to load tools index.</div> : null}

        {!isLoading && !isError ? (
          <>
            <table>
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id}>
                        {header.isPlaceholder ? null : (
                          <button
                            type="button"
                            className="sort-button hover:text-white"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <span className="sort-icon">
                              {header.column.getIsSorted() === 'asc'
                                ? '↑'
                                : header.column.getIsSorted() === 'desc'
                                  ? '↓'
                                  : '↕'}
                            </span>
                          </button>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="text-center py-8 text-slate-400">
                      No tools match the selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            <footer className="pagination">
              <span>
                Showing {table.getRowModel().rows.length} of {filteredTools.length} tools
              </span>
              <div className="pagination-buttons">
                <button type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                  Previous
                </button>
                <span className="px-2 text-slate-300">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
                </span>
                <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                  Next
                </button>
              </div>
            </footer>
          </>
        ) : null}
      </div>
    </section>
  );
}

function GlobalFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#08090c]/80 backdrop-blur-md py-6 px-4 sm:px-8 mt-auto">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Zero Server Storage • Files never leave your browser • 100% Client-Side Privacy
        </span>
        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
          <Link to="/" className="hover:text-white transition-colors">All Tools</Link>
          <Link to="/blog" className="hover:text-amber-400 transition-colors">Blog & Guides</Link>
          <Link to="/sitemap" className="hover:text-rose-400 transition-colors">Sitemap</Link>
        </div>
        <span className="text-xs text-slate-600">
          © {new Date().getFullYear()} Love for PDF. All rights reserved.
        </span>
      </div>
    </footer>
  );
}

function HomePage() {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 w-full py-6 space-y-6">
        <div className="w-full max-w-6xl flex justify-end">
          <div className="bg-[#131520] p-1 rounded-xl border border-white/[0.08] inline-flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Modern Studio View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'table'
                  ? 'bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Table View
            </button>
          </div>
        </div>

        {viewMode === 'grid' ? <PdfFusion /> : <ToolsTanStackTable />}
      </main>
      <GlobalFooter />
    </div>
  );
}

function ToolWorkspacePage() {
  const { slug } = useParams<{ slug: string }>();
  const tool = TOOL_REGISTRY.find((item) => item.slug === slug);

  if (!tool) {
    return <Navigate to="/404" replace />;
  }

  // Full-screen dedicated Studio layout for editor / workflow / redact tools
  const isStudioPage =
    ['edit-pdf', 'redact-pdf', 'create-workflow', 'sign-pdf'].includes(slug || '') ||
    tool.id === 'edit' ||
    tool.id === 'redact' ||
    tool.id === 'workflow';

  if (isStudioPage) {
    return (
      <div className="w-full min-h-screen bg-slate-950 flex flex-col font-sans overflow-x-hidden">
        <ToolWorkspace tool={tool} />
      </div>
    );
  }

  const seo = getToolSeoContent(tool);

  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 py-8 w-full gap-8">
        <ToolWorkspace tool={tool} />

        <section className="w-full max-w-4xl rounded-2xl p-6 bg-[#131520]/90 border border-white/[0.08] space-y-5 shadow-xl">
          <h2 className="text-xl font-bold text-white">About {tool.name}</h2>
          <p className="text-sm text-slate-300 leading-relaxed">{seo.description}</p>

          <div className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">How to use {tool.name}</h3>
            <ol className="list-decimal list-inside text-sm text-slate-300 space-y-1">
              {seo.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">Why use this tool</h3>
            <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
              {seo.benefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-slate-100">Frequently asked questions</h3>
            {seo.faq.map((item) => (
              <article key={item.question} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1">
                <h4 className="text-sm font-semibold text-slate-200">{item.question}</h4>
                <p className="text-sm text-slate-400">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <GlobalFooter />
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="app-shell min-h-screen">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-md bg-[#131520] border border-white/[0.08] p-8 rounded-2xl space-y-4 shadow-2xl">
          <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white">404 — Page Not Found</h1>
          <p className="text-sm text-slate-400">
            The tool or page you requested does not exist or has been moved.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500 text-white font-mono text-xs uppercase tracking-wider hover:bg-rose-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </main>
      <GlobalFooter />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/sitemap" element={<SitemapPage />} />
        <Route path="/blog" element={<BlogIndexPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="/:slug" element={<ToolWorkspacePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
