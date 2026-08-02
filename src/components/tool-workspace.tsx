'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, FileUp, Zap, ArrowUp, ArrowDown, Trash2, Plus,
  RotateCw, Check, Sparkles, Layers, Download,
  GripVertical, AlertCircle, ChevronLeft, ChevronRight, Image as ImageIcon
} from 'lucide-react';
import { ToolDef } from '@/lib/tools-data';
import { ToolIcon, getToolGradient } from './tool-icon';
import { WorkflowBuilder } from './workflow-builder';
import { SignaturePanel, AiToolsPanel, ComparePanel, ScanToPdfPanel } from './interactive-tools';
import { WordCounter } from './word-counter';
import { TextCopier } from './text-copier';
import { GridSelector } from './grid-selector';
import { PdfRedactEditor } from './pdf-redact-editor';
import { MarkdownWorkspace } from './markdown-workspace';
import { PdfEditorPanel } from './pdf-editor-panel';

import {
  mergePdfs, splitPdf, compressPdf, rotatePdf, watermarkPdf, addPageNumbers,
  jpgToPdf, protectPdf, unlockPdf, cropPdf, organizePdf, repairPdf,
  pdfToPdfA, editPdf, htmlToPdf, pdfToWord, pdfToExcel, pdfToPowerPoint,
  officeToPdf, restructurePdf, ocrPdf, pdfForms, downloadBytes, downloadBlob, downloadText
} from '@/lib/pdf-engine';
import { pdfToJpgImages } from '@/lib/engines/conversion-engine';
import { pdfToMarkdown } from '@/lib/engines/markdown-engine';
import { getPdfInfo } from '@/lib/engines/pdf-renderer-engine';

import { PdfFilePreviewCard } from './pdf-file-preview-card';
import { PdfPreviewSidebar } from './pdf-preview-sidebar';

import { useToast } from '@/hooks/use-toast';

export function ToolWorkspace({ tool }: { tool: ToolDef }) {
  const router = useRouter();
  const { toast } = useToast();

  // Multi-file state with HTML5 Drag & Drop reordering & visual drop indicator line
  const [files, setFiles] = useState<File[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // HTML5 Drag & Drop Reordering Handlers with Drop Line Indicator
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedOverIndex !== index) {
      setDraggedOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDraggedOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedOverIndex(null);
      setDraggedIndex(null);
      return;
    }
    const updated = [...files];
    const item = updated.splice(draggedIndex, 1)[0];
    updated.splice(dropIndex, 0, item);
    setFiles(updated);
    setDraggedIndex(null);
    setDraggedOverIndex(null);
  };

  const moveFileUp = (index: number) => {
    if (index === 0) return;
    const updated = [...files];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    setFiles(updated);
  };

  const moveFileDown = (index: number) => {
    if (index === files.length - 1) return;
    const updated = [...files];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    setFiles(updated);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  // Tool Specific Options
  const [rangeStr, setRangeStr] = useState('');
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [splitMode, setSplitMode] = useState<'range' | 'all'>('range');
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [watermarkText, setWatermarkText] = useState('LOVE FOR PDF');
  const [watermarkColor, setWatermarkColor] = useState('#f43f5e');
  const [watermarkSize, setWatermarkSize] = useState(48);
  const [watermarkOpacity, setWatermarkOpacity] = useState(30);
  const [watermarkAngle, setWatermarkAngle] = useState(45);
  const [rotationAngle, setRotationAngle] = useState(90);
  const [pageNumPosition, setPageNumPosition] = useState<'bottom-right' | 'bottom-center' | 'bottom-left' | 'top-right'>('bottom-right');
  const [pageNumFormat, setPageNumFormat] = useState<'number' | 'page_n_of_m'>('page_n_of_m');
  const [pageNumColor, setPageNumColor] = useState('#333333');
  const [compressLevel, setCompressLevel] = useState<'recommended' | 'extreme' | 'less'>('recommended');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [htmlInput, setHtmlInput] = useState('<h1 style="color:#e11d48">Hello from Love for PDF!</h1><p>Converted seamlessly in browser.</p>');
  const [gridRows, setGridRows] = useState(2);
  const [gridCols, setGridCols] = useState(2);
  const [cropMargins, setCropMargins] = useState({ top: 20, right: 20, bottom: 20, left: 20 });
  const [editText, setEditText] = useState('Love for PDF Annotation');
  const [editFontSize, setEditFontSize] = useState(16);
  const [editColor, setEditColor] = useState('#f43f5e');
  // Organize PDF — page order state
  const [organizeOrder, setOrganizeOrder] = useState<number[]>([]);
  // PDF to JPG results
  const [jpgResults, setJpgResults] = useState<{ pageNum: number; dataUrl: string }[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      if (tool.multiFile) {
        setFiles((prev) => [...prev, ...newFiles]);
      } else {
        setFiles(newFiles);
        // Reset page count when new file uploaded
        setPdfPageCount(0);
        setSelectedPages([]);
        setOrganizeOrder([]);
        setJpgResults([]);
      }
    }
  };

  // Load real page count when a PDF file is selected for split/organize
  useEffect(() => {
    const file = files[0];
    if (!file || !['split', 'organize', 'pdf-to-jpg'].includes(tool.id)) return;
    let cancelled = false;
    getPdfInfo(file).then(({ pageCount }) => {
      if (!cancelled) {
        setPdfPageCount(pageCount);
        if (tool.id === 'organize') {
          setOrganizeOrder(Array.from({ length: pageCount }, (_, i) => i));
        }
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [files, tool.id]);

  const togglePageSelect = (pageNum: number) => {
    if (selectedPages.includes(pageNum)) {
      setSelectedPages(selectedPages.filter((p) => p !== pageNum));
    } else {
      setSelectedPages([...selectedPages, pageNum].sort((a, b) => a - b));
    }
  };

  // Organize page drag handlers
  const moveOrganizePage = (from: number, to: number) => {
    const updated = [...organizeOrder];
    const [item] = updated.splice(from, 1);
    updated.splice(to, 0, item);
    setOrganizeOrder(updated);
  };

  const executeCurrentTool = async () => {
    if (
      tool.id !== 'html-to-pdf' &&
      tool.id !== 'workflow' &&
      tool.id !== 'scan-to-pdf' &&
      files.length === 0
    ) {
      toast({ title: 'Please select a file', description: 'Upload a file to run this tool.', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    setProgress(15);

    try {
      const firstFile = files[0];
      const onProg = (p: number) => setProgress(p);

      switch (tool.id) {
        case 'merge': {
          const bytes = await mergePdfs(files, onProg);
          downloadBytes(bytes, `merged-${Date.now()}.pdf`);
          toast({ title: 'PDFs Merged Successfully! ❤️', description: `Combined ${files.length} document(s) in custom sequence.` });
          break;
        }
        case 'split': {
          const range = splitMode === 'all' ? 'all' : selectedPages.length > 0 ? selectedPages.join(',') : rangeStr;
          const bytes = await splitPdf(firstFile, range, onProg);
          downloadBytes(bytes, `split-${firstFile.name}`);
          toast({ title: 'PDF Split Successfully! ✂️' });
          break;
        }
        case 'compress': {
          const levelMap: Record<string, 'low' | 'medium' | 'high'> = {
            recommended: 'medium',
            extreme: 'high',
            less: 'low',
          };
          const bytes = await compressPdf(firstFile, levelMap[compressLevel], onProg);
          downloadBytes(bytes, `compressed-${firstFile.name}`);
          toast({ title: 'PDF Compressed! 🗜️' });
          break;
        }
        case 'rotate': {
          const bytes = await rotatePdf(firstFile, rotationAngle, onProg);
          downloadBytes(bytes, `rotated-${firstFile.name}`);
          toast({ title: `PDF Rotated ${rotationAngle}°! 🔄` });
          break;
        }
        case 'watermark': {
          const bytes = await watermarkPdf(
            firstFile,
            {
              text: watermarkText,
              color: watermarkColor,
              fontSize: watermarkSize,
              opacity: watermarkOpacity / 100,
              rotation: watermarkAngle,
            },
            onProg
          );
          downloadBytes(bytes, `watermarked-${firstFile.name}`);
          toast({ title: 'Watermark Stamped! 💖' });
          break;
        }
        case 'page-numbers': {
          const bytes = await addPageNumbers(
            firstFile,
            { position: pageNumPosition, format: pageNumFormat, color: pageNumColor },
            onProg
          );
          downloadBytes(bytes, `numbered-${firstFile.name}`);
          toast({ title: 'Page Numbers Added! 🔢' });
          break;
        }
        case 'jpg-to-pdf': {
          const bytes = await jpgToPdf(files, onProg);
          downloadBytes(bytes, `images-converted-${Date.now()}.pdf`);
          toast({ title: 'Images Converted to PDF! 📷' });
          break;
        }
        case 'protect': {
          const bytes = await protectPdf(firstFile, password, onProg);
          downloadBytes(bytes, `protected-${firstFile.name}`);
          toast({ title: 'PDF Encrypted & Protected! 🔒' });
          break;
        }
        case 'unlock': {
          const bytes = await unlockPdf(firstFile, password, onProg);
          downloadBytes(bytes, `unlocked-${firstFile.name}`);
          toast({ title: 'PDF Unlocked! 🔓' });
          break;
        }
        case 'crop': {
          const bytes = await cropPdf(firstFile, cropMargins, onProg);
          downloadBytes(bytes, `cropped-${firstFile.name}`);
          toast({ title: 'Margins Cropped! ✂️' });
          break;
        }
        case 'organize': {
          if (organizeOrder.length === 0) {
            toast({ title: 'No page order set', description: 'Load a PDF first to reorder pages.', variant: 'destructive' });
            return;
          }
          const bytes = await organizePdf(firstFile, organizeOrder, onProg);
          downloadBytes(bytes, `organized-${firstFile.name}`);
          toast({ title: 'Pages Reordered & Organized!' });
          break;
        }
        case 'repair': {
          const bytes = await repairPdf(firstFile, onProg);
          downloadBytes(bytes, `repaired-${firstFile.name}`);
          toast({ title: 'Corrupt PDF Repaired! 🛠️' });
          break;
        }
        case 'pdf-a': {
          const bytes = await pdfToPdfA(firstFile, onProg);
          downloadBytes(bytes, `pdf-a-${firstFile.name}`);
          toast({ title: 'Converted to ISO PDF/A Standard! 🏛️' });
          break;
        }
        case 'edit': {
          const bytes = await editPdf(firstFile, [{ page: 1, x: 100, y: 100, text: editText, fontSize: editFontSize, color: editColor }], onProg);
          downloadBytes(bytes, `edited-${firstFile.name}`);
          toast({ title: 'Annotation Added to PDF! ✍️' });
          break;
        }
        case 'html-to-pdf': {
          const bytes = await htmlToPdf(htmlInput, onProg);
          downloadBytes(bytes, `webpage-${Date.now()}.pdf`);
          toast({ title: 'HTML Page Saved as PDF! 🌐' });
          break;
        }
        case 'pdf-to-markdown': {
          const md = await pdfToMarkdown(firstFile, onProg);
          downloadText(md, `${firstFile.name.replace('.pdf', '')}.md`);
          toast({ title: 'Converted to Markdown (.md)! 📝' });
          break;
        }
        case 'pdf-to-word': {
          const blob = await pdfToWord(firstFile, onProg);
          downloadBlob(blob, `${firstFile.name.replace('.pdf', '')}.docx`);
          toast({ title: 'Converted to Word Document (.docx)! 📄', description: 'Reconstructed with Python layout engine.' });
          break;
        }
        case 'pdf-to-excel': {
          const blob = await pdfToExcel(firstFile, onProg);
          downloadBlob(blob, `${firstFile.name.replace('.pdf', '')}.xlsx`);
          toast({ title: 'Extracted to Excel Spreadsheet (.xlsx)! 📊', description: 'Parsed table matrix with Python openpyxl engine.' });
          break;
        }
        case 'pdf-to-ppt': {
          const blob = await pdfToPowerPoint(firstFile, onProg);
          downloadBlob(blob, `${firstFile.name.replace('.pdf', '')}.pptx`);
          toast({ title: 'Converted to PowerPoint Slides (.pptx)! 📊', description: 'Created slides with Python python-pptx engine.' });
          break;
        }
        case 'pdf-to-markdown': {
          const mdText = await pdfToMarkdown(firstFile, onProg);
          const blob = new Blob([mdText], { type: 'text/markdown;charset=utf-8' });
          downloadBlob(blob, `${firstFile.name.replace('.pdf', '')}.md`);
          toast({ title: 'Converted to Markdown (.md)! 📝', description: 'Formatted with Python pdfplumber engine.' });
          break;
        }
        case 'word-to-pdf': {
          const bytes = await officeToPdf(firstFile, 'word', onProg);
          downloadBytes(bytes, `${firstFile.name.replace(/\.[^/.]+$/, '')}.pdf`);
          toast({ title: 'Word Replica PDF Ready! 📄', description: 'Converted with Python high-fidelity engine.' });
          break;
        }
        case 'ppt-to-pdf': {
          const bytes = await officeToPdf(firstFile, 'ppt', onProg);
          downloadBytes(bytes, `${firstFile.name.replace(/\.[^/.]+$/, '')}.pdf`);
          toast({ title: 'PowerPoint Converted to PDF! 📊', description: 'Rendered slides with Python ReportLab engine.' });
          break;
        }
        case 'excel-to-pdf': {
          const bytes = await officeToPdf(firstFile, 'excel', onProg);
          downloadBytes(bytes, `${firstFile.name.replace(/\.[^/.]+$/, '')}.pdf`);
          toast({ title: 'Excel Converted to PDF! 📈', description: 'Formated sheet tables with Python openpyxl engine.' });
          break;
        }
        case 'pdf-to-jpg': {
          const results = await pdfToJpgImages(firstFile, 1.5, onProg);
          setJpgResults(results);
          toast({ title: `PDF Converted! ${results.length} JPG page(s) ready to download.` });
          break;
        }
        case 'ocr': {
          const bytes = await ocrPdf(firstFile, onProg);
          downloadBytes(bytes, `ocr-searchable-${firstFile.name}`);
          toast({ title: 'OCR Searchable PDF Created!' });
          break;
        }
        case 'pdf-forms': {
          const bytes = await pdfForms(firstFile, [{ name: 'Full_Name', type: 'text' }], onProg);
          downloadBytes(bytes, `fillable-form-${firstFile.name}`);
          toast({ title: 'Interactive PDF Form Fields Added!' });
          break;
        }
        case 'restructure': {
          const bytes = await restructurePdf(firstFile, gridRows, gridCols, onProg);
          downloadBytes(bytes, `grid-layout-${firstFile.name}`);
          toast({ title: `Grid N-Up Layout (${gridRows}x${gridCols}) Created!` });
          break;
        }
        default:
          toast({ title: 'Tool Action Complete', description: 'Operation executed.' });
          break;
      }
    } catch (err: any) {
      toast({ title: 'Processing Failed', description: err.message || 'An error occurred.', variant: 'destructive' });
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const showPreviewSidebar = files.length > 0 && ['rotate', 'watermark', 'page-numbers', 'crop'].includes(tool.id);
  const isWideTool = ['word-counter', 'text-copier', 'workflow'].includes(tool.id);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 py-6 px-2 sm:px-4">

      {/* ── BREADCRUMB & HEADER ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="btn-back">
          <ArrowLeft className="w-3.5 h-3.5" /> All Tools
        </Link>
        <span className="text-slate-600">/</span>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md"
            style={{ background: getToolGradient(tool.id) }}
          >
            <ToolIcon iconName={tool.iconName} className="w-4.5 h-4.5 text-white" />
          </div>
          <h1 className="font-display text-xl font-bold tracking-tight text-white">
            {tool.name}
          </h1>
        </div>
      </div>

      {/* ── WORKSTATION LAYOUT ── */}
      <div className={showPreviewSidebar ? "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" : `w-full mx-auto ${isWideTool ? 'max-w-5xl' : 'max-w-3xl'}`}>
        {/* MAIN WORKSPACE PANEL */}
        <div className={`${showPreviewSidebar ? 'lg:col-span-7' : 'w-full'} rounded-2xl p-5 sm:p-6 space-y-5 bg-[#131520]/90 border border-white/[0.08] shadow-lg`}>
          <p className="text-sm leading-relaxed text-slate-300 font-sans">{tool.desc}</p>

          {/* SPECIAL TOOL VIEWS */}
          {tool.id === 'workflow' ? (
            <WorkflowBuilder onClose={() => router.push('/')} />
          ) : tool.id === 'word-counter' ? (
            <WordCounter onBack={() => router.push('/')} />
          ) : tool.id === 'text-copier' ? (
            <TextCopier onBack={() => router.push('/')} />
          ) : tool.id === 'scan-to-pdf' ? (
            <ScanToPdfPanel />
          ) : tool.id === 'sign' && files.length > 0 ? (
            <SignaturePanel file={files[0]} onComplete={() => setFiles([])} />
          ) : (tool.id === 'ai-summarizer' || tool.id === 'translate') && files.length > 0 ? (
            <AiToolsPanel
              file={files[0]}
              mode={tool.id === 'ai-summarizer' ? 'summarize' : 'translate'}
            />
          ) : tool.id === 'redact' && files.length > 0 ? (
            <PdfRedactEditor file={files[0]} onBack={() => setFiles([])} />
          ) : tool.id === 'edit' && files.length > 0 ? (
            <PdfEditorPanel file={files[0]} onClose={() => setFiles([])} />
          ) : tool.id === 'pdf-to-markdown' && files.length > 0 ? (
            <MarkdownWorkspace file={files[0]} />
          ) : tool.id === 'compare' && files.length > 1 ? (
            <ComparePanel files={files} />
          ) : (
            /* STANDARD FILE UPLOAD & RICH CONTROLS WORKSPACE */
            <div className="space-y-6">
              {/* FILE UPLOAD DROP ZONE */}
              {tool.id !== 'html-to-pdf' && tool.id !== 'scan-to-pdf' && (
                <div className="drop-zone">
                  <input
                    type="file"
                    multiple={tool.multiFile}
                    accept={tool.accept || '.pdf'}
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-rose-500/10 border border-rose-500/20 text-rose-400">
                    <FileUp className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-medium text-slate-200">
                    {files.length > 0
                      ? `Drop more files — ${files.length} selected`
                      : `Drop files here or click to browse`}
                  </p>
                  <p className="text-xs mt-1 text-slate-500">100% Client-side processing • Files stay on your device</p>
                </div>
              )}

              {/* SELECTED FILES METADATA & PREVIEW CARDS LIST */}
              {files.length > 0 && tool.id !== 'merge' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[11px] font-medium uppercase tracking-widest"
                      style={{ color: 'hsl(220 10% 38%)' }}
                    >
                      {files.length} file{files.length !== 1 ? 's' : ''} selected
                    </span>
                    {tool.multiFile && (
                      <label
                        className="text-xs font-medium cursor-pointer flex items-center gap-1 transition-colors"
                        style={{ color: 'hsl(348 76% 50%)' }}
                      >
                        <Plus className="w-3 h-3" /> Add More
                        <input type="file" multiple accept={tool.accept || '.pdf'} onChange={handleFileChange} className="hidden" />
                      </label>
                    )}
                  </div>
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {files.map((f, idx) => (
                      <PdfFilePreviewCard
                        key={`${f.name}-${idx}`}
                        file={f}
                        index={idx}
                        totalFiles={files.length}
                        isMultiFile={files.length > 1}
                        onRemove={() => removeFile(idx)}
                        onMoveUp={() => moveFileUp(idx)}
                        onMoveDown={() => moveFileDown(idx)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* MERGE PDF: HTML5 DRAG & DROP REORDERING + VISUAL DROP LINE INDICATOR */}
              {tool.id === 'merge' && files.length > 0 && (
                <div className="ctrl-section space-y-3">
                  <div
                    className="flex items-center justify-between pb-3"
                    style={{ borderBottom: '1px solid hsl(220 12% 14%)' }}
                  >
                    <span className="flex items-center gap-2" style={{ color: 'hsl(220 15% 68%)' }}>
                      <Layers className="w-3.5 h-3.5" style={{ color: 'hsl(348 76% 50%)' }} />
                      <span className="text-xs font-medium">Merge order — {files.length} files</span>
                    </span>
                    <label
                      className="text-xs font-medium cursor-pointer flex items-center gap-1 transition-colors"
                      style={{ color: 'hsl(348 76% 50%)' }}
                    >
                      <Plus className="w-3 h-3" /> Add PDFs
                      <input type="file" multiple accept=".pdf" onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>

                  <p className="text-xs" style={{ color: 'hsl(220 10% 38%)' }}>
                    Drag by handle <GripVertical className="w-3 h-3 inline" style={{ color: 'hsl(348 76% 50%)' }} /> or use ▲▼ buttons to set merge order.
                  </p>

                  <div className="space-y-3">
                    {files.map((file, idx) => (
                      <React.Fragment key={idx}>
                        {/* Drop Line Indicator above item when dragged over */}
                        {draggedOverIndex === idx && draggedIndex !== idx && (
                          <div className="relative py-1 flex items-center justify-center animate-pulse">
                            <div className="w-full h-1 bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 rounded-full shadow-md" />
                            <span className="absolute bg-rose-600 text-white text-[10px] font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                              Drop Here to Insert as Position #{idx + 1}
                            </span>
                          </div>
                        )}

                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDragEnd={handleDragEnd}
                          onDrop={(e) => handleDrop(e, idx)}
                        >
                          <PdfFilePreviewCard
                            file={file}
                            index={idx}
                            totalFiles={files.length}
                            isMultiFile={true}
                            onRemove={() => removeFile(idx)}
                            onMoveUp={() => moveFileUp(idx)}
                            onMoveDown={() => moveFileDown(idx)}
                          />
                        </div>
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="pt-2 text-xs font-semibold text-primary truncate">
                    Sequence: {files.map((f, i) => `${i + 1}. ${f.name}`).join(' → ')}
                  </div>
                </div>
              )}

              {/* SPLIT PDF: INTERACTIVE MODES & PAGE THUMBNAILS */}
              {tool.id === 'split' && files.length > 0 && (
                <div className="ctrl-section space-y-4">
                  <div
                    className="flex items-center justify-between pb-3"
                    style={{ borderBottom: '1px solid hsl(220 12% 14%)' }}
                  >
                    <span className="ctrl-label mb-0">Split Mode</span>
                    <div
                      className="flex gap-1 p-1 rounded-lg"
                      style={{ background: 'hsl(220 12% 10%)' }}
                    >
                      <button
                        onClick={() => setSplitMode('range')}
                        className={`seg-btn${splitMode === 'range' ? ' active' : ''}`}
                      >
                        Extract Selected
                      </button>
                      <button
                        onClick={() => setSplitMode('all')}
                        className={`seg-btn${splitMode === 'all' ? ' active' : ''}`}
                      >
                        Split Every Page
                      </button>
                    </div>
                  </div>

                  {splitMode === 'range' && (
                    <div className="space-y-3">
                      <label className="ctrl-label">
                        Select pages to extract{pdfPageCount > 0 ? ` (${pdfPageCount} total)` : ''}:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from({ length: pdfPageCount || 8 }, (_, i) => i + 1).map((num) => {
                          const isSelected = selectedPages.includes(num);
                          return (
                            <button
                              key={num}
                              onClick={() => togglePageSelect(num)}
                              className={`w-10 h-10 rounded-lg text-xs font-medium flex flex-col items-center justify-center transition-all duration-150 ${
                                isSelected
                                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                                  : 'bg-white/[0.03] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.06]'
                              }`}
                            >
                              {isSelected ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : <span>{num}</span>}
                            </button>
                          );
                        })}
                      </div>
                      <div>
                        <label className="ctrl-label">Or type range:</label>
                        <input
                          type="text"
                          value={rangeStr}
                          onChange={(e) => setRangeStr(e.target.value)}
                          placeholder="e.g. 1-3,5,7"
                          className="form-input"
                        />
                      </div>
                    </div>
                  )}

                  {splitMode === 'all' && (
                    <p className="text-xs text-slate-400">
                      Every page in <strong className="text-slate-200">{files[0]?.name}</strong> will be split into an individual PDF file and downloaded.
                    </p>
                  )}
                </div>
              )}

              {/* COMPRESS PDF CONTROLS */}
              {tool.id === 'compress' && (
                <div className="ctrl-section space-y-3">
                  <span className="ctrl-label">Compression Level</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'recommended', title: 'Recommended', desc: 'Balanced' },
                      { id: 'extreme', title: 'Extreme', desc: 'Max compression' },
                      { id: 'less', title: 'Light', desc: 'High quality' },
                    ].map((lvl) => (
                      <button
                        key={lvl.id}
                        onClick={() => setCompressLevel(lvl.id as any)}
                        className={`p-3 rounded-lg text-left transition-all duration-150 border ${
                          compressLevel === lvl.id
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:bg-white/[0.06]'
                        }`}
                      >
                        <p className="text-xs font-semibold">{lvl.title}</p>
                        <p className="text-[10px] mt-0.5 text-slate-500">{lvl.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ROTATE PDF CONTROLS */}
              {tool.id === 'rotate' && (
                <div className="ctrl-section space-y-3">
                  <span className="ctrl-label">Rotation Angle</span>
                  <div className="flex items-center gap-2">
                    {[90, 180, 270].map((angle) => (
                      <button
                        key={angle}
                        onClick={() => setRotationAngle(angle)}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all duration-150 border ${
                          rotationAngle === angle
                            ? 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                            : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:bg-white/[0.06]'
                        }`}
                      >
                        <RotateCw className="w-3.5 h-3.5" /> {angle}°
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* WATERMARK PDF CONTROLS */}
              {tool.id === 'watermark' && (
                <div className="ctrl-section space-y-4">
                  <span className="ctrl-label">Watermark Settings</span>
                  <div className="space-y-3">
                    <div>
                      <label className="ctrl-label">Text:</label>
                      <input
                        type="text"
                        value={watermarkText}
                        onChange={(e) => setWatermarkText(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="ctrl-label">Color:</label>
                        <input
                          type="color"
                          value={watermarkColor}
                          onChange={(e) => setWatermarkColor(e.target.value)}
                          className="w-full h-8 rounded-lg cursor-pointer bg-white/[0.04] border border-white/[0.12]"
                        />
                      </div>
                      <div>
                        <label className="ctrl-label">Size ({watermarkSize}px):</label>
                        <input
                          type="range" min="12" max="96" value={watermarkSize}
                          onChange={(e) => setWatermarkSize(Number(e.target.value))}
                          className="w-full mt-1 accent-amber-500"
                        />
                      </div>
                      <div>
                        <label className="ctrl-label">Opacity ({watermarkOpacity}%):</label>
                        <input
                          type="range" min="5" max="100" value={watermarkOpacity}
                          onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                          className="w-full mt-1 accent-amber-500"
                        />
                      </div>
                      <div>
                        <label className="ctrl-label">Angle ({watermarkAngle}°):</label>
                        <input
                          type="range" min="0" max="360" step="15" value={watermarkAngle}
                          onChange={(e) => setWatermarkAngle(Number(e.target.value))}
                          className="w-full mt-1 accent-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PAGE NUMBERS CONTROLS */}
              {tool.id === 'page-numbers' && (
                <div className="ctrl-section space-y-3">
                  <span className="ctrl-label">Page Number Settings</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="ctrl-label">Position:</label>
                      <select
                        value={pageNumPosition}
                        onChange={(e) => setPageNumPosition(e.target.value as any)}
                        className="form-input"
                      >
                        <option value="bottom-right">Bottom Right</option>
                        <option value="bottom-center">Bottom Center</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="top-right">Top Right</option>
                      </select>
                    </div>
                    <div>
                      <label className="ctrl-label">Format:</label>
                      <select
                        value={pageNumFormat}
                        onChange={(e) => setPageNumFormat(e.target.value as any)}
                        className="form-input"
                      >
                        <option value="page_n_of_m">Page N of M</option>
                        <option value="number">Number Only</option>
                      </select>
                    </div>
                    <div>
                      <label className="ctrl-label">Text Color:</label>
                      <input
                        type="color" value={pageNumColor}
                        onChange={(e) => setPageNumColor(e.target.value)}
                        className="w-full h-8 rounded-lg cursor-pointer bg-white/[0.04] border border-white/[0.12]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* CROP PDF CONTROLS */}
              {tool.id === 'crop' && (
                <div className="ctrl-section space-y-3">
                  <span className="ctrl-label">Crop Margins (pt)</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {['top', 'right', 'bottom', 'left'].map((side) => (
                      <div key={side}>
                        <label className="ctrl-label capitalize">{side}:</label>
                        <input
                          type="number"
                          value={(cropMargins as any)[side]}
                          onChange={(e) => setCropMargins({ ...cropMargins, [side]: Number(e.target.value) })}
                          className="form-input"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ORGANIZE PDF: REORDERING GRID */}
              {tool.id === 'organize' && files.length > 0 && (
                <div className="ctrl-section space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="ctrl-label mb-0">Reorder Pages ({organizeOrder.length})</span>
                    <button
                      onClick={() => setOrganizeOrder(Array.from({ length: pdfPageCount }, (_, i) => i))}
                      className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {organizeOrder.map((pageIdx, currentPos) => (
                      <div
                        key={currentPos}
                        className="rounded-lg p-2 text-center space-y-1 bg-white/[0.03] border border-white/[0.08]"
                      >
                        <div
                          className="w-full aspect-[3/4] rounded-md flex items-center justify-center text-xs font-semibold bg-white/[0.06] text-slate-300"
                        >
                          {pageIdx + 1}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <button
                            onClick={() => moveOrganizePage(currentPos, currentPos - 1)}
                            disabled={currentPos === 0}
                            className="disabled:opacity-20 transition-colors hover:text-rose-400"
                          >◄</button>
                          <span className="font-mono text-[10px] text-rose-400">#{currentPos + 1}</span>
                          <button
                            onClick={() => moveOrganizePage(currentPos, currentPos + 1)}
                            disabled={currentPos === organizeOrder.length - 1}
                            className="disabled:opacity-20 transition-colors hover:text-rose-400"
                          >►</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PROTECT PDF CONTROLS */}
              {tool.id === 'protect' && (
                <div className="ctrl-section space-y-3">
                  <label className="ctrl-label">Encryption Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter a strong password…"
                      className="form-input pr-16"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-lg text-xs leading-relaxed bg-amber-500/10 border border-amber-500/25 text-amber-300">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                    <p>Password encrypted in-browser. Zero server storage. Cannot be recovered if lost.</p>
                  </div>
                </div>
              )}

              {/* UNLOCK PDF CONTROLS */}
              {tool.id === 'unlock' && (
                <div className="ctrl-section space-y-3">
                  <label className="ctrl-label">PDF Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter the PDF's current password…"
                      className="form-input pr-16"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-lg text-xs leading-relaxed bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                    <p>Enter the PDF's current password. Output file will have the password removed entirely.</p>
                  </div>
                </div>
              )}

              {/* HTML TO PDF CONTROLS */}
              {tool.id === 'html-to-pdf' && (
                <div className="space-y-2">
                  <label className="ctrl-label">HTML Content:</label>
                  <textarea
                    rows={7}
                    value={htmlInput}
                    onChange={(e) => setHtmlInput(e.target.value)}
                    className="form-input font-mono text-xs resize-none leading-relaxed"
                    style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
                  />
                </div>
              )}

              {/* RESTRUCTURE GRID LAYOUT CONTROLS */}
              {tool.id === 'restructure' && (
                <div className="space-y-3 p-4 bg-secondary/50 rounded-2xl border border-border">
                  <label className="text-xs font-bold text-foreground block">Select Sheet N-Up Grid Layout:</label>
                  <GridSelector
                    initialRows={gridRows}
                    initialCols={gridCols}
                    onChange={(r: number, c: number) => { setGridRows(r); setGridCols(c); }}
                  />
                </div>
              )}

              {/* PROGRESS BAR */}
              {processing && (
                <div className="progress-fancy">
                  <div style={{ width: `${progress}%` }} />
                </div>
              )}

              {/* PROCESS BUTTON */}
              <button
                onClick={executeCurrentTool}
                disabled={
                  processing ||
                  (tool.id !== 'html-to-pdf' && tool.id !== 'scan-to-pdf' && files.length === 0)
                }
                className="btn-fun w-full py-3.5 rounded-xl flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    Process &amp; Download {tool.name}
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT PREVIEW SIDEBAR - ONLY RENDERED WHEN VISUAL PREVIEW IS NEEDED */}
        {showPreviewSidebar && (
          <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
            <PdfPreviewSidebar
              file={files[0]}
              files={files}
              toolId={tool.id}
              toolName={tool.name}
              rotationAngle={rotationAngle}
              watermarkConfig={{
                text: watermarkText,
                color: watermarkColor,
                size: watermarkSize,
                opacity: watermarkOpacity,
                angle: watermarkAngle,
              }}
              pageNumConfig={{
                position: pageNumPosition,
                format: pageNumFormat,
                color: pageNumColor,
              }}
              cropMargins={cropMargins}
              password={password}
              compressLevel={compressLevel}
              htmlContent={htmlInput}
            />
          </div>
        )}
      </div>
    </div>
  );
}
