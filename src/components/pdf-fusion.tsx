'use client';

import { useState, useCallback } from 'react';
import { 
  Merge, Grid, RotateCw, Scissors, Combine, Download, 
  ArrowLeftRight, Columns, Rows, FileText, ChevronRight,
  Layers, FileCheck, ZapIcon, Copy
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ToolView, DropZone, FileListDisplay, ActionButton, ProgressBar } from './tool-view';
import { GridSelector } from './grid-selector';
import { mergePdfs, restructurePdf, rotatePdf, extractPages, mergeAndRestructure, downloadPdf } from '@/lib/pdf-ops';
import { WordCounter } from './word-counter';
import { TextCopier } from './text-copier';

type Tool = null | 'merge' | 'restructure' | 'merge-restructure' | 'rotate' | 'extract' | 'word-counter' | 'text-copier';

interface PdfFile { id: string; file: File; name: string; }

const TOOLS = [
  {
    id: 'merge' as const,
    name: 'Merge',
    desc: 'Combine multiple PDFs into one seamless document',
    icon: <Merge className="w-7 h-7" />,
    colorClass: 'tool-merge',
    bg: 'bg-blue-500',
    gradient: 'from-blue-500 to-blue-600',
    badge: 'Multi-file',
  },
  {
    id: 'restructure' as const,
    name: 'Grid Layout',
    desc: 'Fit multiple pages onto a single sheet in any grid',
    icon: <Grid className="w-7 h-7" />,
    colorClass: 'tool-restructure',
    bg: 'bg-violet-500',
    gradient: 'from-violet-500 to-purple-600',
    badge: 'N-up Print',
  },
  {
    id: 'rotate' as const,
    name: 'Rotate',
    desc: 'Rotate all pages 90° clockwise in one click',
    icon: <RotateCw className="w-7 h-7" />,
    colorClass: 'tool-rotate',
    bg: 'bg-cyan-500',
    gradient: 'from-cyan-500 to-teal-500',
    badge: '90° CW',
  },
  {
    id: 'extract' as const,
    name: 'Extract Pages',
    desc: 'Pull out specific pages by number or range',
    icon: <Scissors className="w-7 h-7" />,
    colorClass: 'tool-extract',
    bg: 'bg-emerald-500',
    gradient: 'from-emerald-500 to-green-600',
    badge: 'Page Range',
  },
  {
    id: 'merge-restructure' as const,
    name: 'Merge + Grid',
    desc: 'Merge multiple PDFs then arrange them on sheets',
    icon: <Combine className="w-7 h-7" />,
    colorClass: 'tool-combo',
    bg: 'bg-orange-500',
    gradient: 'from-orange-500 to-amber-500',
    badge: '2-in-1',
  },
  {
    id: 'word-counter' as const,
    name: 'Word Counter',
    desc: 'Count words, analyze readability & extract text from any doc',
    icon: <FileText className="w-7 h-7" />,
    colorClass: 'tool-words',
    bg: 'bg-rose-500',
    gradient: 'from-rose-500 to-pink-600',
    badge: 'All Formats',
  },
  {
    id: 'text-copier' as const,
    name: 'Text Copier',
    desc: 'Extract document text and copy it sequentially in custom word chunks',
    icon: <Copy className="w-7 h-7" />,
    colorClass: 'tool-copy',
    bg: 'bg-violet-600',
    gradient: 'from-violet-600 to-indigo-600',
    badge: 'Next-Next Copy',
  },
];

export function PdfFusion() {
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const { toast } = useToast();

  const [files, setFiles] = useState<PdfFile[]>([]);
  const [singleFile, setSingleFile] = useState<PdfFile | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [gridRows, setGridRows] = useState(2);
  const [gridCols, setGridCols] = useState(2);
  const [mode, setMode] = useState<'horizontal' | 'vertical'>('horizontal');
  const [extractRange, setExtractRange] = useState('');

  const reset = useCallback(() => {
    setFiles([]); setSingleFile(null); setProcessing(false); setProgress(0); setExtractRange('');
  }, []);

  const goBack = () => { reset(); setActiveTool(null); };

  const addFiles = (fileList: FileList) => {
    const arr = Array.from(fileList).filter(f => f.type === 'application/pdf').map(f => ({
      id: crypto.randomUUID(), file: f, name: f.name,
    }));
    if (!arr.length) { toast({ title: 'Only PDFs allowed', variant: 'destructive' }); return; }
    if (activeTool === 'merge' || activeTool === 'merge-restructure') {
      setFiles(prev => [...prev, ...arr]);
    } else {
      setSingleFile(arr[0]);
    }
  };

  const err = (msg: string) => toast({ title: 'Error', description: msg, variant: 'destructive' });
  const ok = (msg: string) => toast({ title: '✅ Done!', description: msg });

  const run = async (fn: () => Promise<void>) => {
    setProcessing(true); setProgress(0);
    try { await fn(); } catch (e: any) { err(e.message || 'Something went wrong'); }
    finally { setProcessing(false); setProgress(0); }
  };

  // ── Dashboard ──────────────────────────────────────────────────────────────
  if (!activeTool) {
    return (
      <div className="w-full max-w-6xl animate-fade-up">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/20 text-primary text-xs font-semibold mb-5 animate-pop-in">
            <ZapIcon className="w-3.5 h-3.5" />
            100% client-side · no uploads · no storage
          </div>
          <h1 className="text-5xl sm:text-7xl fun-title mb-4 leading-none">PDFusion</h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto leading-relaxed">
            Professional PDF tools that run entirely in your browser. Pick a tool and get to work.
          </p>
        </div>

        {/* Tool Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-stagger">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              className={`tool-card text-left w-full ${t.colorClass} group`}
              style={{ '--t': `var(--${t.colorClass.replace('tool-', 'tool-')})` } as React.CSSProperties}
            >
              {/* Badge */}
              <div className="flex items-start justify-between mb-5">
                <div className={`tool-icon ${t.bg} text-white`}>
                  {t.icon}
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full bg-gradient-to-r ${t.gradient} text-white shadow-sm`}>
                  {t.badge}
                </span>
              </div>

              <h3 className="text-lg font-bold text-foreground mb-1.5 group-hover:text-primary transition-colors">
                {t.name}
              </h3>
              <p className="text-sm text-muted-foreground leading-snug mb-4">{t.desc}</p>

              <div className="flex items-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0">
                Open tool <ChevronRight className="w-3.5 h-3.5" />
              </div>

              {/* Decorative corner shimmer */}
              <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-bl ${t.gradient} opacity-[0.04]`} />
            </button>
          ))}
        </div>

        {/* Bottom badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-10 text-xs text-muted-foreground">
          {['No file size limit', 'Works offline', 'Zero tracking', 'Open in any browser'].map(f => (
            <span key={f} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border">
              <FileCheck className="w-3 h-3 text-emerald-500" /> {f}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const toolMeta = TOOLS.find(t => t.id === activeTool)!;

  // ── Merge ──────────────────────────────────────────────────────────────────
  if (activeTool === 'merge') {
    return (
      <ToolView title={toolMeta.name} description={toolMeta.desc} icon={toolMeta.icon} colorClass={toolMeta.colorClass} gradient={toolMeta.gradient} bg={toolMeta.bg} onBack={goBack}>
        <DropZone onFiles={addFiles} multiple label="Drop PDFs here or click to add" />
        <FileListDisplay files={files} onRemove={(id) => setFiles(f => f.filter(x => x.id !== id))} draggable onReorder={setFiles} />
        <ProgressBar value={progress} />
        <ActionButton
          onClick={() => run(async () => {
            if (files.length < 2) { err('Add at least 2 PDFs'); return; }
            const bytes = await mergePdfs(files, setProgress);
            downloadPdf(bytes, 'merged.pdf');
            ok('PDFs merged!'); setFiles([]);
          })}
          disabled={files.length < 2} processing={processing}
          label="Merge PDFs" processingLabel="Merging…" icon={<Merge className="w-5 h-5" />}
        />
      </ToolView>
    );
  }

  // ── Restructure ────────────────────────────────────────────────────────────
  if (activeTool === 'restructure') {
    return (
      <ToolView title={toolMeta.name} description={toolMeta.desc} icon={toolMeta.icon} colorClass={toolMeta.colorClass} gradient={toolMeta.gradient} bg={toolMeta.bg} onBack={goBack}>
        <DropZone onFiles={addFiles} label="Drop a PDF here" />
        {singleFile && <FileListDisplay files={[singleFile]} onRemove={() => setSingleFile(null)} />}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-5 border-t border-border/60">
          <div className="space-y-3">
            <label className="text-sm font-semibold flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-primary" /> Fill Direction
            </label>
            <div className="flex gap-2">
              {(['horizontal', 'vertical'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all border ${mode === m ? 'bg-primary text-white border-primary shadow-md' : 'bg-secondary text-muted-foreground border-border hover:text-foreground'}`}>
                  {m === 'horizontal' ? <><Columns className="w-4 h-4 inline mr-1.5" />Horizontal</> : <><Rows className="w-4 h-4 inline mr-1.5" />Vertical</>}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-sm font-semibold flex items-center gap-2">
              <Grid className="w-4 h-4 text-primary" /> Grid Size
            </label>
            <GridSelector initialRows={gridRows} initialCols={gridCols} maxRows={8} maxCols={8}
              onChange={(r, c) => { setGridRows(r); setGridCols(c); }} />
            <p className="text-xs text-muted-foreground">{gridRows}×{gridCols} = {gridRows * gridCols} pages per sheet</p>
          </div>
        </div>
        <ProgressBar value={progress} />
        <ActionButton
          onClick={() => run(async () => {
            if (!singleFile) { err('Add a PDF first'); return; }
            const bytes = await restructurePdf(singleFile.file, singleFile.name, gridRows, gridCols, mode, setProgress);
            downloadPdf(bytes, `restructured_${singleFile.name}`);
            ok('Restructured!'); setSingleFile(null);
          })}
          disabled={!singleFile} processing={processing}
          label="Restructure & Download" processingLabel="Restructuring…" icon={<Download className="w-5 h-5" />}
        />
      </ToolView>
    );
  }

  // ── Rotate ─────────────────────────────────────────────────────────────────
  if (activeTool === 'rotate') {
    return (
      <ToolView title={toolMeta.name} description={toolMeta.desc} icon={toolMeta.icon} colorClass={toolMeta.colorClass} gradient={toolMeta.gradient} bg={toolMeta.bg} onBack={goBack}>
        <DropZone onFiles={addFiles} label="Drop a PDF here" />
        {singleFile && <FileListDisplay files={[singleFile]} onRemove={() => setSingleFile(null)} />}
        <ProgressBar value={progress} />
        <ActionButton
          onClick={() => run(async () => {
            if (!singleFile) { err('Add a PDF first'); return; }
            const bytes = await rotatePdf(singleFile.file, singleFile.name, setProgress);
            downloadPdf(bytes, `rotated_${singleFile.name}`);
            ok('Rotated 90° clockwise!'); setSingleFile(null);
          })}
          disabled={!singleFile} processing={processing}
          label="Rotate 90° Clockwise" processingLabel="Rotating…" icon={<RotateCw className="w-5 h-5" />}
        />
      </ToolView>
    );
  }

  // ── Extract ────────────────────────────────────────────────────────────────
  if (activeTool === 'extract') {
    return (
      <ToolView title={toolMeta.name} description={toolMeta.desc} icon={toolMeta.icon} colorClass={toolMeta.colorClass} gradient={toolMeta.gradient} bg={toolMeta.bg} onBack={goBack}>
        <DropZone onFiles={addFiles} label="Drop a PDF here" />
        {singleFile && <FileListDisplay files={[singleFile]} onRemove={() => setSingleFile(null)} />}
        <div className="space-y-2">
          <label htmlFor="extract-range" className="text-sm font-semibold">Page Range</label>
          <input
            id="extract-range" placeholder="e.g. 1-3, 5, 8-10" value={extractRange}
            onChange={(e) => setExtractRange(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm transition-all"
          />
          <p className="text-xs text-muted-foreground">Separate pages with commas, use dashes for ranges</p>
        </div>
        <ProgressBar value={progress} />
        <ActionButton
          onClick={() => run(async () => {
            if (!singleFile) { err('Add a PDF first'); return; }
            if (!extractRange.trim()) { err('Enter page numbers'); return; }
            const bytes = await extractPages(singleFile.file, singleFile.name, extractRange, setProgress);
            downloadPdf(bytes, `extracted_${singleFile.name}`);
            ok('Pages extracted!');
          })}
          disabled={!singleFile || !extractRange.trim()} processing={processing}
          label="Extract Pages" processingLabel="Extracting…" icon={<Scissors className="w-5 h-5" />}
        />
      </ToolView>
    );
  }

  // ── Merge + Restructure ────────────────────────────────────────────────────
  if (activeTool === 'merge-restructure') {
    return (
      <ToolView title={toolMeta.name} description={toolMeta.desc} icon={toolMeta.icon} colorClass={toolMeta.colorClass} gradient={toolMeta.gradient} bg={toolMeta.bg} onBack={goBack}>
        <DropZone onFiles={addFiles} multiple label="Drop PDFs here or click to add" />
        <FileListDisplay files={files} onRemove={(id) => setFiles(f => f.filter(x => x.id !== id))} draggable onReorder={setFiles} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-5 border-t border-border/60">
          <div className="space-y-3">
            <label className="text-sm font-semibold flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-primary" /> Fill Direction
            </label>
            <div className="flex gap-2">
              {(['horizontal', 'vertical'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all border ${mode === m ? 'bg-primary text-white border-primary shadow-md' : 'bg-secondary text-muted-foreground border-border hover:text-foreground'}`}>
                  {m === 'horizontal' ? <><Columns className="w-4 h-4 inline mr-1.5" />Horizontal</> : <><Rows className="w-4 h-4 inline mr-1.5" />Vertical</>}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-sm font-semibold flex items-center gap-2">
              <Grid className="w-4 h-4 text-primary" /> Grid Size
            </label>
            <GridSelector initialRows={gridRows} initialCols={gridCols} maxRows={8} maxCols={8}
              onChange={(r, c) => { setGridRows(r); setGridCols(c); }} />
            <p className="text-xs text-muted-foreground">{gridRows}×{gridCols} = {gridRows * gridCols} pages per sheet</p>
          </div>
        </div>
        <ProgressBar value={progress} />
        <ActionButton
          onClick={() => run(async () => {
            if (files.length < 1) { err('Add at least 1 PDF'); return; }
            const bytes = await mergeAndRestructure(files, gridRows, gridCols, mode, setProgress);
            downloadPdf(bytes, 'merged_restructured.pdf');
            ok('Merged & restructured!'); setFiles([]);
          })}
          disabled={files.length < 1} processing={processing}
          label="Merge & Restructure" processingLabel="Processing…" icon={<Combine className="w-5 h-5" />}
        />
      </ToolView>
    );
  }

  // ── Word Counter ───────────────────────────────────────────────────────────
  if (activeTool === 'word-counter') {
    return <WordCounter onBack={goBack} />;
  }

  // ── Text Copier ────────────────────────────────────────────────────────────
  if (activeTool === 'text-copier') {
    return <TextCopier onBack={goBack} />;
  }

  return null;
}
