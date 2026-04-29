'use client';

import { useState, useCallback } from 'react';
import { Merge, Grid, RotateCw, Scissors, Combine, Download, ArrowLeftRight, Columns, Rows } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ToolView, DropZone, FileListDisplay, ActionButton, ProgressBar } from './tool-view';
import { GridSelector } from './grid-selector';
import { mergePdfs, restructurePdf, rotatePdf, extractPages, mergeAndRestructure, downloadPdf } from '@/lib/pdf-ops';

type Tool = null | 'merge' | 'restructure' | 'merge-restructure' | 'rotate' | 'extract';

interface PdfFile { id: string; file: File; name: string; }

const TOOLS = [
  { id: 'merge' as const, name: 'Merge', desc: 'Combine multiple PDFs into one', icon: <Merge className="w-6 h-6" />, color: 'bg-slate-500/15 text-slate-700' },
  { id: 'restructure' as const, name: 'Restructure', desc: 'Fit multiple pages on one sheet', icon: <Grid className="w-6 h-6" />, color: 'bg-indigo-500/15 text-indigo-700' },
  { id: 'rotate' as const, name: 'Rotate', desc: 'Rotate all pages 90°', icon: <RotateCw className="w-6 h-6" />, color: 'bg-blue-500/15 text-blue-700' },
  { id: 'extract' as const, name: 'Extract', desc: 'Pull out specific pages', icon: <Scissors className="w-6 h-6" />, color: 'bg-teal-500/15 text-teal-700' },
  { id: 'merge-restructure' as const, name: 'Merge + Grid', desc: 'Merge then arrange on sheets', icon: <Combine className="w-6 h-6" />, color: 'bg-emerald-500/15 text-emerald-700' },
];

export function PdfFusion() {
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const { toast } = useToast();

  // Shared state
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
  const ok = (msg: string) => toast({ title: '✨ Done!', description: msg });

  const run = async (fn: () => Promise<void>) => {
    setProcessing(true); setProgress(0);
    try { await fn(); } catch (e: any) { err(e.message || 'Something went wrong'); }
    finally { setProcessing(false); setProgress(0); }
  };

  // --- Dashboard ---
  if (!activeTool) {
    return (
      <div className="w-full max-w-3xl mx-auto">
        <div className="text-center mb-10 sm:mb-12">
          <h1 className="text-4xl sm:text-6xl fun-title mb-3">PDFusion</h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
            Simple PDF tools that just work. Pick a tool and go.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-stagger">
          {TOOLS.map((t) => (
            <button key={t.id} onClick={() => setActiveTool(t.id)} className="tool-card text-left w-full">
              <div className={`tool-icon ${t.color}`}>{t.icon}</div>
              <h3 className="text-lg font-semibold text-foreground">{t.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const toolMeta = TOOLS.find(t => t.id === activeTool)!;

  // --- Merge ---
  if (activeTool === 'merge') {
    return (
      <ToolView title={toolMeta.name} description={toolMeta.desc} icon={toolMeta.icon} color={toolMeta.color} onBack={goBack}>
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
          label="Merge PDFs" processingLabel="Merging..." icon={<Merge className="w-5 h-5" />}
        />
      </ToolView>
    );
  }

  // --- Restructure ---
  if (activeTool === 'restructure') {
    return (
      <ToolView title={toolMeta.name} description={toolMeta.desc} icon={toolMeta.icon} color={toolMeta.color} onBack={goBack}>
        <DropZone onFiles={addFiles} label="Drop a PDF here" />
        {singleFile && (
          <FileListDisplay files={[singleFile]} onRemove={() => setSingleFile(null)} />
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-border">
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-primary" /> Fill Direction
            </label>
            <div className="flex gap-2">
              {(['horizontal', 'vertical'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${mode === m ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                  {m === 'horizontal' ? <Columns className="w-4 h-4 inline mr-1.5" /> : <Rows className="w-4 h-4 inline mr-1.5" />}
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Grid className="w-4 h-4 text-primary" /> Grid Size
            </label>
            <GridSelector initialRows={gridRows} initialCols={gridCols} maxRows={8} maxCols={8}
              onChange={(r, c) => { setGridRows(r); setGridCols(c); }} />
            <p className="text-xs text-muted-foreground">{gridRows}×{gridCols} = {gridRows * gridCols} pages/sheet</p>
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
          label="Restructure & Download" processingLabel="Restructuring..." icon={<Download className="w-5 h-5" />}
        />
      </ToolView>
    );
  }

  // --- Rotate ---
  if (activeTool === 'rotate') {
    return (
      <ToolView title={toolMeta.name} description={toolMeta.desc} icon={toolMeta.icon} color={toolMeta.color} onBack={goBack}>
        <DropZone onFiles={addFiles} label="Drop a PDF here" />
        {singleFile && (
          <FileListDisplay files={[singleFile]} onRemove={() => setSingleFile(null)} />
        )}
        <ProgressBar value={progress} />
        <ActionButton
          onClick={() => run(async () => {
            if (!singleFile) { err('Add a PDF first'); return; }
            const bytes = await rotatePdf(singleFile.file, singleFile.name, setProgress);
            downloadPdf(bytes, `rotated_${singleFile.name}`);
            ok('Rotated 90° clockwise!'); setSingleFile(null);
          })}
          disabled={!singleFile} processing={processing}
          label="Rotate 90° Clockwise" processingLabel="Rotating..." icon={<RotateCw className="w-5 h-5" />}
        />
      </ToolView>
    );
  }

  // --- Extract ---
  if (activeTool === 'extract') {
    return (
      <ToolView title={toolMeta.name} description={toolMeta.desc} icon={toolMeta.icon} color={toolMeta.color} onBack={goBack}>
        <DropZone onFiles={addFiles} label="Drop a PDF here" />
        {singleFile && (
          <FileListDisplay files={[singleFile]} onRemove={() => setSingleFile(null)} />
        )}
        <div className="space-y-2">
          <label htmlFor="extract-range" className="text-sm font-medium">Page Range</label>
          <input
            id="extract-range" placeholder="e.g. 1-3, 5, 8-10" value={extractRange}
            onChange={(e) => setExtractRange(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
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
          label="Extract Pages" processingLabel="Extracting..." icon={<Scissors className="w-5 h-5" />}
        />
      </ToolView>
    );
  }

  // --- Merge + Restructure ---
  if (activeTool === 'merge-restructure') {
    return (
      <ToolView title={toolMeta.name} description={toolMeta.desc} icon={toolMeta.icon} color={toolMeta.color} onBack={goBack}>
        <DropZone onFiles={addFiles} multiple label="Drop PDFs here or click to add" />
        <FileListDisplay files={files} onRemove={(id) => setFiles(f => f.filter(x => x.id !== id))} draggable onReorder={setFiles} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-border">
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-primary" /> Fill Direction
            </label>
            <div className="flex gap-2">
              {(['horizontal', 'vertical'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${mode === m ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                  {m === 'horizontal' ? <Columns className="w-4 h-4 inline mr-1.5" /> : <Rows className="w-4 h-4 inline mr-1.5" />}
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Grid className="w-4 h-4 text-primary" /> Grid Size
            </label>
            <GridSelector initialRows={gridRows} initialCols={gridCols} maxRows={8} maxCols={8}
              onChange={(r, c) => { setGridRows(r); setGridCols(c); }} />
            <p className="text-xs text-muted-foreground">{gridRows}×{gridCols} = {gridRows * gridCols} pages/sheet</p>
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
          label="Merge & Restructure" processingLabel="Processing..." icon={<Combine className="w-5 h-5" />}
        />
      </ToolView>
    );
  }

  return null;
}
