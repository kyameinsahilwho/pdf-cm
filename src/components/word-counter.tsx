'use client';

import React, { useState, useMemo, useRef } from 'react';
import { 
  FileText, Search, BookOpen, Volume2, Copy, Check, Download, ArrowLeft,
  Sparkles, Sliders, AlertCircle, BarChart3, ChevronRight, HelpCircle
} from 'lucide-react';
import { extractText, type ParseResult } from '@/lib/doc-parser';
import { DropZone, ProgressBar } from './tool-view';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

// English stop words for exclusion in keywords frequency
const STOP_WORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 
  'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 
  'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 
  'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 
  'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 
  'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 
  'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 
  'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 
  'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 
  'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'd', 
  'll', 'm', 'o', 're', 've', 'y', 'ain', 'aren', 'couldn', 'didn', 'doesn', 'hadn', 
  'hasn', 'haven', 'isn', 'ma', 'mightn', 'mustn', 'needn', 'shan', 'shouldn', 'wasn', 
  'weren', 'won', 'wouldn'
]);

interface AnalyzedFile {
  id: string;
  name: string;
  size: number;
  text: string;
  pagesCount: number;
  wordCount: number;
  charCount: number;
  charNoSpaces: number;
  sentenceCount: number;
  paragraphCount: number;
  syllablesCount: number;
}

export function WordCounter({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [analyzedFiles, setAnalyzedFiles] = useState<AnalyzedFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // UI preferences
  const [excludeStopWords, setExcludeStopWords] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const selectedFile = useMemo(() => {
    return analyzedFiles.find(f => f.id === selectedFileId) || analyzedFiles[0] || null;
  }, [analyzedFiles, selectedFileId]);

  // Syllable counting heuristic
  const countSyllables = (word: string): number => {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length === 0) return 0;
    if (word.length <= 3) return 1;
    
    // remove silent e, ed, es at the end
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    
    const vowelClusters = word.match(/[aeiouy]{1,2}/g);
    return vowelClusters ? vowelClusters.length : 1;
  };

  // Run full analysis on extracted text
  const analyzeText = (text: string, fileName: string, size: number, pagesCount: number): AnalyzedFile => {
    const cleanText = text.trim();
    if (!cleanText) {
      return {
        id: crypto.randomUUID(),
        name: fileName,
        size,
        text: '',
        pagesCount: 0,
        wordCount: 0,
        charCount: 0,
        charNoSpaces: 0,
        sentenceCount: 0,
        paragraphCount: 0,
        syllablesCount: 0
      };
    }

    const words = cleanText.split(/\s+/).filter(Boolean);
    const charCount = text.length;
    const charNoSpaces = text.replace(/\s/g, '').length;
    
    // Sentences ending in ., ?, or !
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = Math.max(1, sentences.length);
    
    // Paragraphs split by newlines
    const paragraphs = text.split(/\n\s*\n+/).filter(p => p.trim().length > 0);
    const paragraphCount = Math.max(1, paragraphs.length);

    // Calculate total syllables
    let syllablesCount = 0;
    for (let i = 0; i < words.length; i++) {
      syllablesCount += countSyllables(words[i]);
    }

    return {
      id: crypto.randomUUID(),
      name: fileName,
      size,
      text,
      pagesCount,
      wordCount: words.length,
      charCount,
      charNoSpaces,
      sentenceCount,
      paragraphCount,
      syllablesCount
    };
  };

  const handleFiles = async (fileList: FileList) => {
    setProcessing(true);
    setProgress(0);

    const newAnalyzed: AnalyzedFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const result = await extractText(file, (p) => {
          // Map single file progress to overall progress
          const fileContribution = 100 / fileList.length;
          const currentProgress = (i * fileContribution) + (p * fileContribution / 100);
          setProgress(currentProgress);
        });

        const parsed = analyzeText(result.text, file.name, file.size, result.pagesCount);
        newAnalyzed.push(parsed);
      } catch (err: any) {
        toast({
          title: `Error parsing ${file.name}`,
          description: err.message || 'Check if the file is corrupted.',
          variant: 'destructive'
        });
      }
    }

    if (newAnalyzed.length > 0) {
      setAnalyzedFiles(prev => {
        const next = [...prev, ...newAnalyzed];
        // Select the first new file
        setSelectedFileId(newAnalyzed[0].id);
        return next;
      });
      toast({
        title: 'Files Analyzed!',
        description: `Successfully analyzed ${newAnalyzed.length} document(s).`
      });
    }

    setProcessing(false);
    setProgress(0);
  };

  // Calculate readability score
  const readability = useMemo(() => {
    if (!selectedFile) return null;
    
    const { wordCount, sentenceCount, syllablesCount } = selectedFile;
    if (wordCount === 0 || sentenceCount === 0) {
      return { score: 100, label: 'N/A', desc: 'Add text to calculate' };
    }

    // Flesch Reading Ease Formula
    const score = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllablesCount / wordCount);
    const rounded = Math.min(100, Math.max(0, Math.round(score)));

    let label = '';
    let desc = '';
    if (rounded >= 90) {
      label = 'Very Easy';
      desc = '5th grade reading level. Extremely simple to understand.';
    } else if (rounded >= 80) {
      label = 'Easy';
      desc = '6th grade level. Conversational style, clear prose.';
    } else if (rounded >= 70) {
      label = 'Fairly Easy';
      desc = '7th grade level. Mildly descriptive prose.';
    } else if (rounded >= 60) {
      label = 'Standard';
      desc = '8th & 9th grade level. Clean, standard English.';
    } else if (rounded >= 50) {
      label = 'Fairly Difficult';
      desc = 'High school reading proficiency recommended.';
    } else if (rounded >= 30) {
      label = 'Difficult';
      desc = 'College level. Best for technical documents or academic journals.';
    } else {
      label = 'Very Difficult';
      desc = 'Graduate level. Highly complex, dense language.';
    }

    return { score: rounded, label, desc };
  }, [selectedFile]);

  // Timing stats
  const timings = useMemo(() => {
    if (!selectedFile) return null;
    const { wordCount } = selectedFile;
    // Average reading speed: 200 WPM
    const readMin = wordCount / 200;
    const readSec = Math.ceil((readMin % 1) * 60);
    const readStr = readMin >= 1 
      ? `${Math.floor(readMin)}m ${readSec}s` 
      : `${readSec}s`;

    // Average speaking speed: 140 WPM
    const speakMin = wordCount / 140;
    const speakSec = Math.ceil((speakMin % 1) * 60);
    const speakStr = speakMin >= 1 
      ? `${Math.floor(speakMin)}m ${speakSec}s` 
      : `${speakSec}s`;

    return { reading: readStr, speaking: speakStr };
  }, [selectedFile]);

  // Keyword frequency analysis
  const keywords = useMemo(() => {
    if (!selectedFile || !selectedFile.text) return [];

    const words = selectedFile.text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'\n\r]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2); // Ignore single/double character letters

    const freqMap: { [key: string]: number } = {};
    words.forEach(w => {
      if (excludeStopWords && STOP_WORDS.has(w)) return;
      freqMap[w] = (freqMap[w] || 0) + 1;
    });

    return Object.entries(freqMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [selectedFile, excludeStopWords]);

  // Highlights search occurrences in preview text
  const previewContent = useMemo(() => {
    if (!selectedFile) return '';
    const text = selectedFile.text;
    if (!searchQuery.trim()) return text;

    const regex = new RegExp(`(${searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) => 
      regex.test(part) 
        ? <mark key={i} className="bg-yellow-200 text-black px-0.5 rounded font-medium">{part}</mark>
        : part
    );
  }, [selectedFile, searchQuery]);

  // Copy text to clipboard
  const handleCopy = () => {
    if (!selectedFile) return;
    navigator.clipboard.writeText(selectedFile.text);
    setCopied(true);
    toast({ title: 'Copied!', description: 'Document text copied to clipboard.' });
    setTimeout(() => setCopied(false), 2000);
  };

  // Download raw text as .txt file
  const handleDownload = () => {
    if (!selectedFile) return;
    const blob = new Blob([selectedFile.text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedFile.name.replace(/\.[^/.]+$/, "")}_extracted.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const removeFile = (id: string) => {
    setAnalyzedFiles(prev => {
      const next = prev.filter(f => f.id !== id);
      if (selectedFileId === id) {
        setSelectedFileId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  };

  return (
    <div className="animate-fade-up w-full max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <button onClick={onBack} className="btn-back mb-4">
            <ArrowLeft className="w-4 h-4" /> All Tools
          </button>
          <div className="flex items-center gap-3">
            <div className="tool-icon bg-rose-500 text-white">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Word Counter</h2>
              <p className="text-sm text-muted-foreground">Analyze words, readability &amp; extract text from any document — instantly.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Upload Zone & Document List - 4 Cols on Large Screen */}
        <div className="lg:col-span-4 space-y-4">
          <div className="tool-card p-6 space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Upload Documents</h3>
            <DropZone 
              onFiles={handleFiles} 
              multiple 
              label="Drop PDF, DOCX, or Text here" 
              accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*,.md,.json,.csv,.js,.ts,.py,.css,.html,.xml"
            />
            {processing && <ProgressBar value={progress} />}
          </div>

          {/* List of Loaded Files */}
          {analyzedFiles.length > 0 && (
            <div className="tool-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Loaded Files ({analyzedFiles.length})
                </h3>
                <button 
                  onClick={() => setAnalyzedFiles([])} 
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {analyzedFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFileId(file.id)}
                    className={`group flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                      selectedFile?.id === file.id
                        ? 'border-violet-500 bg-violet-500/5 shadow-sm'
                        : 'border-border bg-card hover:bg-secondary/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`p-1.5 rounded-lg shrink-0 ${
                        selectedFile?.id === file.id ? 'bg-violet-500/10 text-violet-600' : 'bg-muted text-muted-foreground'
                      }`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate text-foreground">{file.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {file.wordCount.toLocaleString()} words • {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0 ml-2"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Analytics Dashboard - 8 Cols on Large Screen */}
        <div className="lg:col-span-8 space-y-6">
          {selectedFile ? (
            <div className="space-y-6">
              
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="stat-card bg-card border border-border p-4 rounded-2xl shadow-sm text-center">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Words</span>
                  <div className="text-3xl font-extrabold text-violet-600 mt-1">{selectedFile.wordCount.toLocaleString()}</div>
                </div>
                
                <div className="stat-card bg-card border border-border p-4 rounded-2xl shadow-sm text-center">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Characters</span>
                  <div className="text-3xl font-extrabold text-foreground mt-1">{selectedFile.charCount.toLocaleString()}</div>
                  <span className="text-[9px] text-muted-foreground">({selectedFile.charNoSpaces.toLocaleString()} no spaces)</span>
                </div>

                <div className="stat-card bg-card border border-border p-4 rounded-2xl shadow-sm text-center">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Sentences</span>
                  <div className="text-3xl font-extrabold text-foreground mt-1">{selectedFile.sentenceCount.toLocaleString()}</div>
                </div>

                <div className="stat-card bg-card border border-border p-4 rounded-2xl shadow-sm text-center">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Paragraphs</span>
                  <div className="text-3xl font-extrabold text-foreground mt-1">{selectedFile.paragraphCount.toLocaleString()}</div>
                  <span className="text-[9px] text-muted-foreground">({selectedFile.pagesCount} estimated page{selectedFile.pagesCount !== 1 ? 's' : ''})</span>
                </div>
              </div>

              {/* Insights & Keyword density */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Timing & Complexity */}
                <div className="tool-card p-6 space-y-5">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <Sparkles className="w-4 h-4 text-violet-500" /> Readability & Timing
                  </h3>
                  
                  {readability && (
                    <div className="flex items-center gap-4 p-3 bg-secondary/30 rounded-2xl border border-border">
                      <div className="relative shrink-0 flex items-center justify-center w-14 h-14 rounded-full bg-violet-500/10 text-violet-700 font-extrabold text-lg">
                        {readability.score}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold flex items-center gap-1">
                          {readability.label}
                        </h4>
                        <p className="text-xs text-muted-foreground leading-snug mt-0.5">{readability.desc}</p>
                      </div>
                    </div>
                  )}

                  {timings && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
                        <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Reading Time</p>
                          <p className="text-sm font-bold mt-0.5">{timings.reading}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
                        <div className="p-2 bg-orange-500/10 text-orange-600 rounded-lg">
                          <Volume2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Speaking Time</p>
                          <p className="text-sm font-bold mt-0.5">{timings.speaking}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Keyword Frequency */}
                <div className="tool-card p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <BarChart3 className="w-4 h-4 text-violet-500" /> Key Vocabulary
                    </h3>
                    <div className="flex items-center gap-1.5 bg-secondary/60 p-1 rounded-lg border border-border">
                      <button
                        onClick={() => setExcludeStopWords(true)}
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-all ${
                          excludeStopWords ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                        }`}
                      >
                        Clean
                      </button>
                      <button
                        onClick={() => setExcludeStopWords(false)}
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-all ${
                          !excludeStopWords ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                        }`}
                      >
                        All Words
                      </button>
                    </div>
                  </div>

                  {keywords.length > 0 ? (
                    <div className="space-y-2">
                      {keywords.map(([word, freq], idx) => {
                        const maxFreq = keywords[0][1];
                        const pct = (freq / maxFreq) * 100;
                        return (
                          <div key={word} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-semibold text-foreground flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground font-mono">#{idx+1}</span>
                                {word}
                              </span>
                              <span className="text-muted-foreground font-semibold">{freq} count</span>
                            </div>
                            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div 
                                style={{ width: `${pct}%` }} 
                                className="h-full bg-violet-500 rounded-full"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-32 flex flex-col items-center justify-center text-center text-muted-foreground">
                      <AlertCircle className="w-5 h-5 mb-1 opacity-40" />
                      <p className="text-xs">No repeating keywords found.</p>
                    </div>
                  )}
                </div>

              </div>

              {/* Text Preview and Search */}
              <div className="tool-card p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <FileText className="w-4 h-4 text-violet-500" /> Extracted Text Preview
                  </h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleCopy} 
                      className="btn-back px-3 py-1.5 h-auto text-xs flex items-center gap-1.5 bg-secondary/50"
                      title="Copy to Clipboard"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button 
                      onClick={handleDownload} 
                      className="btn-back px-3 py-1.5 h-auto text-xs flex items-center gap-1.5 bg-secondary/50"
                      title="Download text file"
                    >
                      <Download className="w-3.5 h-3.5" /> Download TXT
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search words in preview..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <ScrollArea className="h-60 rounded-xl bg-secondary/30 border border-border p-4">
                  <pre className="text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed select-text font-sans">
                    {previewContent}
                  </pre>
                </ScrollArea>
              </div>

            </div>
          ) : (
            <div className="tool-card py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-700 animate-bounce">
                <FileText className="w-8 h-8" />
              </div>
              <div className="max-w-xs space-y-1">
                <h3 className="font-bold text-lg text-foreground">No Document Loaded</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Drag and drop a PDF, Word, or plain text file in the sidebar to view full analytics and word counts.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
