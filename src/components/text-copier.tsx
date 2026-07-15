'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Copy, Check, ArrowLeft, Download, Search, BookOpen, Volume2, VolumeX,
  AlertCircle, ChevronRight, FileText, ChevronLeft, Settings, Type, RefreshCw
} from 'lucide-react';
import { extractText } from '@/lib/doc-parser';
import { DropZone, ProgressBar } from './tool-view';
import { useToast } from '@/hooks/use-toast';

interface ExtractedDoc {
  name: string;
  size: number;
  text: string;
  wordCount: number;
  charCount: number;
}

interface TextChunk {
  index: number;
  text: string;
  wordCount: number;
  charCount: number;
  startWordIndex: number;
  endWordIndex: number;
}

export function TextCopier({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [doc, setDoc] = useState<ExtractedDoc | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Chunking and copying states
  const [chunkSize, setChunkSize] = useState<number>(1000);
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number>(0);
  const [copiedChunks, setCopiedChunks] = useState<Record<number, boolean>>({});
  
  // UI and visual options
  const [fontSize, setFontSize] = useState<number>(16);
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif'>('sans');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  
  // Reset states when a new file is uploaded
  const handleFiles = async (fileList: FileList) => {
    if (!fileList.length) return;
    setProcessing(true);
    setProgress(0);

    const file = fileList[0];
    try {
      const result = await extractText(file, (p) => {
        setProgress(p);
      });

      const cleanText = result.text.trim();
      const words = cleanText ? cleanText.split(/\s+/).filter(Boolean) : [];

      setDoc({
        name: file.name,
        size: file.size,
        text: result.text,
        wordCount: words.length,
        charCount: result.text.length
      });

      setCurrentChunkIndex(0);
      setCopiedChunks({});
      setSearchQuery('');
      
      toast({
        title: 'Document Parsed!',
        description: `Extracted ${words.length.toLocaleString()} words from ${file.name}.`
      });
    } catch (err: any) {
      toast({
        title: `Error parsing document`,
        description: err.message || 'Check if the file is valid.',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  // Perform word chunking while preserving spacing and formatting
  const chunks = useMemo((): TextChunk[] => {
    if (!doc || !doc.text || chunkSize <= 0) return [];
    
    const text = doc.text;
    const regex = /\S+/g;
    const wordMatches: { word: string; start: number; end: number }[] = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      wordMatches.push({
        word: match[0],
        start: match.index,
        end: regex.lastIndex
      });
    }
    
    if (wordMatches.length === 0) return [];
    
    const textChunks: TextChunk[] = [];
    for (let i = 0; i < wordMatches.length; i += chunkSize) {
      const chunkWords = wordMatches.slice(i, i + chunkSize);
      const firstWord = chunkWords[0];
      const lastWord = chunkWords[chunkWords.length - 1];
      
      // Slice original text from start of first word to end of last word
      // This preserves newlines, spaces and formatting between words
      const chunkText = text.substring(firstWord.start, lastWord.end);
      
      textChunks.push({
        index: Math.floor(i / chunkSize) + 1,
        text: chunkText,
        wordCount: chunkWords.length,
        charCount: chunkText.length,
        startWordIndex: i + 1,
        endWordIndex: i + chunkWords.length
      });
    }
    
    return textChunks;
  }, [doc, chunkSize]);

  const currentChunk = useMemo(() => {
    if (chunks.length === 0 || currentChunkIndex < 0 || currentChunkIndex >= chunks.length) {
      return null;
    }
    return chunks[currentChunkIndex];
  }, [chunks, currentChunkIndex]);

  // Adjust chunk index when chunks list changes
  useEffect(() => {
    if (chunks.length > 0 && currentChunkIndex >= chunks.length) {
      setCurrentChunkIndex(chunks.length - 1);
    }
  }, [chunks, currentChunkIndex]);

  // Text search highlighter
  const highlightedChunkText = useMemo(() => {
    if (!currentChunk) return '';
    const text = currentChunk.text;
    if (!searchQuery.trim()) return text;

    try {
      const escapedQuery = searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(${escapedQuery})`, 'gi');
      const parts = text.split(regex);
      return parts.map((part, i) => 
        regex.test(part) 
          ? <mark key={i} className="bg-yellow-200 text-black px-0.5 rounded font-semibold">{part}</mark>
          : part
      );
    } catch (e) {
      return text;
    }
  }, [currentChunk, searchQuery]);

  // Speech synthesis controls
  const handleSpeak = () => {
    if (typeof window === 'undefined') return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else if (currentChunk) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentChunk.text);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [currentChunkIndex]);

  // Copy helper
  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      } catch (err) {
        document.body.removeChild(textArea);
        return false;
      }
    }
  };

  const handleCopyCurrent = async () => {
    if (!currentChunk) return;
    const success = await copyText(currentChunk.text);
    if (success) {
      setCopiedChunks(prev => ({ ...prev, [currentChunk.index]: true }));
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1500);
      toast({
        title: `Chunk ${currentChunk.index} copied!`,
        description: `Copied ${currentChunk.wordCount} words to clipboard.`,
      });
    } else {
      toast({
        title: 'Copy failed',
        description: 'Could not copy chunk text.',
        variant: 'destructive'
      });
    }
  };

  const handleCopyAndNext = async () => {
    if (!currentChunk) return;
    const success = await copyText(currentChunk.text);
    if (success) {
      setCopiedChunks(prev => ({ ...prev, [currentChunk.index]: true }));
      
      const isLast = currentChunkIndex === chunks.length - 1;
      
      toast({
        title: isLast ? 'Last chunk copied! 🎉' : `Chunk ${currentChunk.index} copied!`,
        description: isLast 
          ? 'Completed! All parts of the document have been copied.'
          : 'Clipboard updated. Automatically moving to the next chunk.',
      });

      if (!isLast) {
        setCurrentChunkIndex(prev => prev + 1);
      } else {
        setJustCopied(true);
        setTimeout(() => setJustCopied(false), 1500);
      }
    } else {
      toast({
        title: 'Copy failed',
        description: 'Could not copy chunk text.',
        variant: 'destructive'
      });
    }
  };

  // Stats calculation
  const totalCopiedWords = useMemo(() => {
    return chunks.reduce((acc, chunk) => {
      return acc + (copiedChunks[chunk.index] ? chunk.wordCount : 0);
    }, 0);
  }, [chunks, copiedChunks]);

  const copyProgressPercent = useMemo(() => {
    if (chunks.length === 0) return 0;
    const count = Object.values(copiedChunks).filter(Boolean).length;
    return (count / chunks.length) * 100;
  }, [chunks, copiedChunks]);

  // Download raw chunk as text file
  const handleDownloadChunk = (chunk: TextChunk) => {
    const blob = new Blob([chunk.text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const suffix = doc ? doc.name.replace(/\.[^/.]+$/, "") : "document";
    link.download = `${suffix}_chunk_${chunk.index}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Filter chunks matching query
  const filteredChunks = useMemo(() => {
    if (!searchQuery.trim()) return chunks;
    return chunks.filter(c => c.text.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [chunks, searchQuery]);

  return (
    <div className="animate-fade-up w-full max-w-6xl mx-auto space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <button onClick={onBack} className="btn-back mb-4">
            <ArrowLeft className="w-4 h-4" /> All Tools
          </button>
          <div className="flex items-center gap-3">
            <div className="tool-icon bg-violet-600 text-white" style={{ '--t': '280 85% 55%' } as React.CSSProperties}>
              <Copy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Text Extractor &amp; Chunk Copier
              </h2>
              <p className="text-sm text-muted-foreground">
                Extract text from PDFs and copy it in sequential word chunks, perfect for copying long pages.
              </p>
            </div>
          </div>
        </div>
      </div>

      {!doc ? (
        /* Upload Dashboard */
        <div className="max-w-2xl mx-auto">
          <div className="tool-card p-8 sm:p-12 space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-foreground">Select a Document</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Upload any PDF or text file. It will be parsed client-side inside your browser.
              </p>
            </div>
            <DropZone 
              onFiles={handleFiles} 
              label="Drop PDF or Text file here" 
              accept="application/pdf,text/*,.md,.json,.csv"
            />
            {processing && (
              <div className="space-y-2">
                <ProgressBar value={progress} />
                <p className="text-xs text-center text-muted-foreground">Extracting layout &amp; word mapping...</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Main Workspace split panel */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left panel: Config and Chunk checklist - 4 cols */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* File Info */}
            <div className="tool-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-violet-600/10 text-violet-600">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate text-foreground">{doc.name}</p>
                    <p className="text-[10px] text-muted-foreground">{(doc.size / 1024).toFixed(1)} KB · {doc.wordCount.toLocaleString()} words</p>
                  </div>
                </div>
                <button 
                  onClick={() => setDoc(null)} 
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/5 hover:border-destructive/20 transition-all shrink-0 ml-2"
                >
                  Change File
                </button>
              </div>

              {/* Progress Summary */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-muted-foreground uppercase">
                  <span>Progress Copied</span>
                  <span>{Object.keys(copiedChunks).length} of {chunks.length} Chunks</span>
                </div>
                <div className="progress-fancy h-2 mt-1">
                  <div style={{ width: `${copyProgressPercent}%` }} className="bg-violet-600" />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                  <span>{totalCopiedWords.toLocaleString()} words copied</span>
                  {Object.keys(copiedChunks).length > 0 && (
                    <button 
                      onClick={() => setCopiedChunks({})}
                      className="text-violet-600 hover:underline flex items-center gap-0.5"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> Reset status
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Chunk settings configuration */}
            <div className="tool-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-violet-600" /> Chunk Configuration
                </h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-foreground">Words per Chunk:</span>
                  <input 
                    type="number" 
                    min="10"
                    max="10000"
                    value={chunkSize}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        setChunkSize(val);
                      } else if (e.target.value === '') {
                        setChunkSize(0);
                      }
                    }}
                    onBlur={() => {
                      if (chunkSize < 10) setChunkSize(10);
                    }}
                    className="w-20 px-2 py-1 text-sm font-bold text-center border border-border bg-card rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>

                <input 
                  type="range"
                  min="100"
                  max="3000"
                  step="100"
                  value={chunkSize || 100}
                  onChange={(e) => setChunkSize(parseInt(e.target.value))}
                  className="w-full accent-violet-600 cursor-pointer h-1.5 bg-secondary rounded-lg appearance-none"
                />

                {/* Preset quick buttons */}
                <div className="grid grid-cols-5 gap-1">
                  {[250, 500, 1000, 1500, 2000].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setChunkSize(preset)}
                      className={`text-[10px] font-bold py-1.5 px-0.5 rounded-lg border transition-all ${
                        chunkSize === preset
                          ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                          : 'bg-card text-muted-foreground hover:bg-secondary/50 border-border'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chunk List / Checklist */}
            <div className="tool-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Chunks Checklist ({chunks.length})
                </h3>
              </div>

              {/* Search within checklist */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search and filter chunks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 text-foreground"
                />
              </div>

              {/* Scrollable chunks list */}
              <div className="max-h-[300px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                {filteredChunks.length === 0 ? (
                  <p className="text-xs text-center text-muted-foreground py-6">No chunks matches search.</p>
                ) : (
                  filteredChunks.map((c) => (
                    <div
                      key={c.index}
                      onClick={() => setCurrentChunkIndex(c.index - 1)}
                      className={`group flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        currentChunkIndex === c.index - 1
                          ? 'border-violet-600 bg-violet-600/5 shadow-sm'
                          : 'border-border bg-card hover:bg-secondary/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs font-extrabold ${
                          currentChunkIndex === c.index - 1 
                            ? 'bg-violet-600 text-white' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {c.index}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-foreground">
                            Words {c.startWordIndex.toLocaleString()} - {c.endWordIndex.toLocaleString()}
                          </p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">
                            {c.wordCount} words · {c.charCount.toLocaleString()} chars
                          </p>
                        </div>
                      </div>

                      {/* Status checkbox / copied checkmark */}
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {copiedChunks[c.index] ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600">
                            <Check className="w-3 h-3 stroke-[3px]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-border group-hover:border-violet-500/50 transition-colors" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right panel: Active Chunk Copy Dashboard - 8 cols */}
          <div className="lg:col-span-8 space-y-5">
            {currentChunk ? (
              <div className="tool-card p-6 space-y-6 relative overflow-hidden"
                   style={{ boxShadow: '0 2px 0 hsl(220 20% 70%), 0 8px 32px hsl(220 20% 50% / 0.12)' }}>
                
                {/* Visual completion effect if current chunk is copied */}
                {copiedChunks[currentChunk.index] && (
                  <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
                    <div className="bg-emerald-500 text-white text-[9px] font-bold py-1 text-center w-[140px] rotate-45 translate-x-[25px] translate-y-[15px] shadow-sm uppercase tracking-widest flex items-center justify-center gap-0.5">
                      <Check className="w-2.5 h-2.5 stroke-[3px]" /> Copied
                    </div>
                  </div>
                )}

                {/* Chunk Workspace Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Chunk {currentChunk.index} of {chunks.length}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                      Words {currentChunk.startWordIndex.toLocaleString()} to {currentChunk.endWordIndex.toLocaleString()} ({currentChunk.wordCount} words)
                    </p>
                  </div>

                  {/* Reading adjustment tools */}
                  <div className="flex items-center gap-2">
                    {/* Text Size */}
                    <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1 border border-border">
                      <button 
                        onClick={() => setFontSize(prev => Math.max(12, prev - 2))}
                        className="p-1 hover:bg-background rounded text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
                        title="Decrease text size"
                      >
                        A-
                      </button>
                      <span className="text-[10px] font-bold px-1 text-muted-foreground w-7 text-center">{fontSize}px</span>
                      <button 
                        onClick={() => setFontSize(prev => Math.min(28, prev + 2))}
                        className="p-1 hover:bg-background rounded text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
                        title="Increase text size"
                      >
                        A+
                      </button>
                    </div>

                    {/* Font Family Toggle */}
                    <button
                      onClick={() => setFontFamily(prev => prev === 'sans' ? 'serif' : 'sans')}
                      className="p-2 hover:bg-secondary rounded-lg border border-border hover:text-foreground text-muted-foreground transition-all"
                      title="Toggle Font Style"
                    >
                      <Type className="w-4 h-4" />
                    </button>

                    {/* Text to Speech */}
                    <button
                      onClick={handleSpeak}
                      className={`p-2 rounded-lg border transition-all ${
                        isSpeaking 
                          ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                          : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                      title={isSpeaking ? "Stop listening" : "Listen to chunk"}
                    >
                      {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>

                    {/* Download Raw Chunk */}
                    <button
                      onClick={() => handleDownloadChunk(currentChunk)}
                      className="p-2 hover:bg-secondary rounded-lg border border-border hover:text-foreground text-muted-foreground transition-all"
                      title="Download chunk as TXT"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* The main scrollable text area */}
                <div 
                  className={`p-5 rounded-2xl bg-secondary/20 border border-border/80 max-h-[360px] overflow-y-auto leading-relaxed select-text ${
                    fontFamily === 'serif' ? 'font-serif' : 'font-sans'
                  }`}
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {highlightedChunkText}
                </div>

                {/* Primary actions and Copier Flow */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    
                    {/* Big copy button */}
                    <button
                      onClick={handleCopyCurrent}
                      className={`flex-1 flex items-center justify-center gap-2.5 font-extrabold text-sm py-4 rounded-2xl border transition-all select-none shadow ${
                        copiedChunks[currentChunk.index]
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-500/30 hover:bg-emerald-100/50'
                          : 'bg-card text-foreground border-border hover:bg-secondary/40 hover:border-violet-500/30'
                      }`}
                    >
                      {justCopied ? (
                        <>
                          <Check className="w-4.5 h-4.5 text-emerald-600 stroke-[3px]" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4.5 h-4.5 text-violet-600" />
                          Copy Chunk {currentChunk.index}
                        </>
                      )}
                    </button>

                    {/* COPY & NEXT (High focus key button) */}
                    <button
                      onClick={handleCopyAndNext}
                      className="flex-1 btn-fun bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center gap-2.5 text-sm py-4 border-b-[3px] border-violet-800"
                      style={{ boxShadow: '0 4px 12px hsl(280 85% 55% / 0.25)' }}
                    >
                      <Copy className="w-4.5 h-4.5" />
                      <span>
                        {currentChunkIndex === chunks.length - 1 ? 'Copy & Complete' : 'Copy & Next Chunk'}
                      </span>
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>

                  {/* Navigation row controls */}
                  <div className="flex justify-between items-center bg-secondary/30 p-2 rounded-xl border border-border/50">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCurrentChunkIndex(0)}
                        disabled={currentChunkIndex === 0}
                        className="px-2.5 py-1.5 rounded-lg hover:bg-card border border-transparent disabled:opacity-40 text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
                      >
                        First
                      </button>
                      <button
                        onClick={() => setCurrentChunkIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentChunkIndex === 0}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-card border border-transparent disabled:opacity-40 text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Prev
                      </button>
                    </div>

                    <span className="text-xs font-bold text-muted-foreground">
                      {currentChunkIndex + 1} / {chunks.length}
                    </span>

                    <div className="flex gap-1">
                      <button
                        onClick={() => setCurrentChunkIndex(prev => Math.min(chunks.length - 1, prev + 1))}
                        disabled={currentChunkIndex === chunks.length - 1}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-card border border-transparent disabled:opacity-40 text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
                      >
                        Next <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setCurrentChunkIndex(chunks.length - 1)}
                        disabled={currentChunkIndex === chunks.length - 1}
                        className="px-2.5 py-1.5 rounded-lg hover:bg-card border border-transparent disabled:opacity-40 text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="tool-card p-12 text-center text-muted-foreground space-y-4">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
                <div>
                  <h3 className="font-bold text-foreground">No active chunks</h3>
                  <p className="text-sm mt-1">Adjust your Word Chunk size configuration to regenerate chunks.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
