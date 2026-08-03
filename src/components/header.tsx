import { Link, useLocation } from 'react-router-dom';
import { Logo } from '@/components/logo';
import { ShieldCheck, BookOpen, Map } from 'lucide-react';

export function Header() {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <header className="glass-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-6">

        {/* Logo + Professional Italic Wordmark */}
        <Link to="/" className="flex items-center gap-3 shrink-0 group">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-white/[0.04] border border-white/[0.1] shadow-inner transition-all duration-200 group-hover:border-amber-500/40 group-hover:bg-white/[0.08]">
            <Logo className="h-4.5 w-4.5" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-sans-head text-sm font-semibold tracking-tight text-white group-hover:text-slate-200 transition-colors">
              Love for
            </span>
            <span className="font-serif italic text-lg text-amber-400 font-normal">
              PDF
            </span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
              pathname === '/'
                ? 'text-slate-100 bg-white/[0.08]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            All PDF Tools
          </Link>
          <Link
            to="/blog"
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
              pathname.startsWith('/blog')
                ? 'text-amber-400 bg-amber-500/10 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Blog & Guides</span>
          </Link>
          <Link
            to="/sitemap"
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
              pathname === '/sitemap'
                ? 'text-rose-400 bg-rose-500/10 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            <span>Sitemap</span>
          </Link>
        </nav>

        {/* Right side status badge */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero Server Storage • 100% Client-Side</span>
          </div>
        </div>
      </div>
    </header>
  );
}
