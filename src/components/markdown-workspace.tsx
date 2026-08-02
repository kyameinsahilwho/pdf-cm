'use client';

import React, { useState, useEffect } from 'react';
import { FileCode, Copy, Download, Sparkles, Check, FileUp, RefreshCw } from 'lucide-react';
import { pdfToMarkdown, markdownToPdf } from '@/lib/engines/markdown-engine';
import { downloadText, downloadBytes } from '@/lib/engines/core-pdf-engine';
import { useToast } from '@/hooks/use-toast';

export function MarkdownWorkspace({ file }: { file: File }) {
  const { toast } = useToast();

  const [markdown, setMarkdown] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [convertingToPdf, setConvertingToPdf] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    async function extract() {
      setLoading(true);
      try {
        const md = await pdfToMarkdown(file, (p) => {
          if (active) setProgress(p);
        });
        if (active) {
          setMarkdown(md);
        }
      } catch (err: any) {
        toast({ title: 'Extraction Error', description: err.message, variant: 'destructive' });
      } finally {
        if (active) setLoading(false);
      }
    }
    extract();
    return () => { active = false; };
  }, [file]);

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    toast({ title: 'Copied to Clipboard! 📋' });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadMd = () => {
    downloadText(markdown, `${file.name.replace(/\.[^/.]+$/, '')}.md`, 'text/markdown');
    toast({ title: 'Markdown File Downloaded! 📝' });
  };

  const handleDownloadPdf = async () => {
    setConvertingToPdf(true);
    try {
      const bytes = await markdownToPdf(markdown, file.name);
      downloadBytes(bytes, `compiled-${file.name.replace(/\.[^/.]+$/, '')}.pdf`);
      toast({ title: 'Compiled PDF Downloaded! 📄' });
    } catch (err: any) {
      toast({ title: 'PDF Compilation Error', description: err.message, variant: 'destructive' });
    } finally {
      setConvertingToPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card border-2 border-border rounded-3xl p-8 text-center space-y-4">
        <div className="flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <h3 className="text-lg font-bold text-foreground font-heading">
            Extracting PDF Text & Structure to Markdown...
          </h3>
          <div className="w-full max-w-md bg-secondary h-2.5 rounded-full overflow-hidden border border-border">
            <div
              className="bg-gradient-to-r from-rose-500 to-pink-600 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground font-semibold">{Math.round(progress)}%</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-secondary/40 border border-border p-4 rounded-2xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
              activeTab === 'editor' ? 'bg-primary text-white shadow-md' : 'bg-card text-foreground hover:bg-secondary'
            }`}
          >
            Markdown Editor
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
              activeTab === 'preview' ? 'bg-primary text-white shadow-md' : 'bg-card text-foreground hover:bg-secondary'
            }`}
          >
            Formatted Preview
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 bg-card hover:bg-secondary border border-border text-foreground rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-primary" />}
            {copied ? 'Copied!' : 'Copy Markdown'}
          </button>

          <button
            onClick={handleDownloadMd}
            className="px-3 py-1.5 bg-card hover:bg-secondary border border-border text-foreground rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            Download .md
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={convertingToPdf}
            className="btn-love px-4 py-1.5 rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {convertingToPdf ? 'Compiling PDF...' : 'Compile to PDF'}
          </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      {activeTab === 'editor' ? (
        <div className="space-y-2">
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            rows={18}
            className="w-full bg-card border-2 border-border rounded-2xl p-4 text-xs font-mono text-foreground focus:outline-none focus:border-primary shadow-inner leading-relaxed"
          />
        </div>
      ) : (
        <div className="bg-card border-2 border-border rounded-2xl p-6 prose max-w-none text-foreground font-sans text-xs space-y-4 max-h-[500px] overflow-y-auto">
          {markdown.split('\n').map((line, i) => {
            if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-primary border-b border-border pb-1 my-2">{line.substring(2)}</h1>;
            if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-foreground border-b border-border pb-1 my-2">{line.substring(3)}</h2>;
            if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold text-foreground my-1">{line.substring(4)}</h3>;
            if (line.startsWith('• ') || line.startsWith('- ')) return <li key={i} className="ml-4 list-disc text-muted-foreground">{line.substring(2)}</li>;
            if (!line.trim()) return <br key={i} />;
            return <p key={i} className="leading-relaxed text-muted-foreground my-1">{line}</p>;
          })}
        </div>
      )}
    </div>
  );
}
