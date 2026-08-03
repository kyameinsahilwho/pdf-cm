'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Type, Edit3, Square, Download, Trash2, Check, RefreshCw, Crosshair,
  Image as ImageIcon, ZoomIn, ZoomOut, Maximize2, X, ChevronLeft, ChevronRight,
  Eye, MousePointer, Layers, Bold, Italic, Sparkles, Plus, Undo2, Sliders,
  Move, CornerDownLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { downloadBytes } from '@/lib/pdf-engine';

export interface EditAnnotation {
  id: string;
  type: 'text' | 'pen' | 'rect' | 'highlight' | 'replace_text' | 'remove_image' | 'image';
  page: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  bbox?: [number, number, number, number];
  text?: string;
  fontSize?: number;
  color?: string;
  bgColor?: string;
  font?: string;
  isBold?: boolean;
  isItalic?: boolean;
  points?: Array<{ x: number; y: number }>;
  imgData?: string;
}

interface DetectedSpan {
  id: string;
  text: string;
  bbox: [number, number, number, number];
  x: number;
  y: number;
  w: number;
  h: number;
  font: string;
  size: number;
  color: string;
  isBold?: boolean;
  isItalic?: boolean;
}

interface DetectedImage {
  id: string;
  bbox: [number, number, number, number];
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PdfEditorPanelProps {
  file: File;
  onClose?: () => void;
}

export function PdfEditorPanel({ file, onClose }: PdfEditorPanelProps) {
  const { toast } = useToast();

  // Studio Mode: 'inspect' (Select & Edit Text/Images), 'text' (Add Text), 'pen' (Draw), 'image' (Stamp Image)
  const [activeTool, setActiveTool] = useState<'inspect' | 'text' | 'pen' | 'image'>('inspect');
  
  // Active Inspector Formatting Controls
  const [selectedColor, setSelectedColor] = useState('#f43f5e');
  const [fontSize, setFontSize] = useState(14);
  const [selectedFont, setSelectedFont] = useState('Helvetica');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);

  // Navigation & Zoom State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1.3);
  const [annotations, setAnnotations] = useState<EditAnnotation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Dimensions for pixel-perfect bounding box alignment
  const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number }>({ width: 612, height: 792 });
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({ width: 795, height: 1030 });

  // Inspection & Layer Disambiguation State
  const [detectedSpans, setDetectedSpans] = useState<DetectedSpan[]>([]);
  const [detectedImages, setDetectedImages] = useState<DetectedImage[]>([]);
  const [inspecting, setInspecting] = useState(false);
  const [editingSpan, setEditingSpan] = useState<DetectedSpan | null>(null);
  const [overlappingLayers, setOverlappingLayers] = useState<Array<{ type: 'span' | 'image'; data: any }> | null>(null);
  const [layerPopupPos, setLayerPopupPos] = useState<{ x: number; y: number } | null>(null);

  // Text Addition & Pen Drawing State
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPenPoints, setCurrentPenPoints] = useState<Array<{ x: number; y: number }>>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Render PDF Page via unpdf / PDF.js proxy
  useEffect(() => {
    let active = true;
    async function renderPage() {
      try {
        const { getDocumentProxy } = await import('unpdf');
        const buf = await file.arrayBuffer();
        const pdf = await getDocumentProxy(new Uint8Array(buf));
        if (!active) return;
        setTotalPages(pdf.numPages);

        const page = await pdf.getPage(currentPage);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        setPdfDimensions({ width: unscaledViewport.width, height: unscaledViewport.height });

        const viewport = page.getViewport({ scale: zoomLevel });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        setCanvasDimensions({ width: canvas.width, height: canvas.height });

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      } catch (err) {
        console.error('[PdfEditorPanel] Page render error:', err);
      }
    }
    renderPage();
    return () => { active = false; };
  }, [file, currentPage, zoomLevel]);

  // Inspect page text & image elements via PyMuPDF backend API
  useEffect(() => {
    let active = true;
    async function fetchElements() {
      setInspecting(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('page', currentPage.toString());

        const res = await fetch('/api/inspect-pdf', { method: 'POST', body: formData });
        if (res.ok && active) {
          const data = await res.json();
          setDetectedSpans(data.spans || []);
          setDetectedImages(data.images || []);
          if (data.width && data.height) {
            setPdfDimensions({ width: data.width, height: data.height });
          }
        }
      } catch (err) {
        console.warn('[PdfEditorPanel] Element inspection unavailable:', err);
      } finally {
        if (active) setInspecting(false);
      }
    }
    fetchElements();
    return () => { active = false; };
  }, [file, currentPage]);

  // Exact scale factors for 100% pixel-perfect bounding box positioning
  const scaleX = pdfDimensions.width > 0 ? canvasDimensions.width / pdfDimensions.width : 1;
  const scaleY = pdfDimensions.height > 0 ? canvasDimensions.height / pdfDimensions.height : 1;

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (overlappingLayers) {
      setOverlappingLayers(null);
      return;
    }

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (activeTool === 'text') {
      setTextPosition({ x: clickX, y: clickY });
      setTextInput('');
    } else if (activeTool === 'inspect') {
      // Find matching text spans & images at click location
      const matchingSpans = detectedSpans.filter((span) => {
        const x = span.x * scaleX;
        const y = span.y * scaleY;
        const w = span.w * scaleX;
        const h = span.h * scaleY;
        return clickX >= x - 4 && clickX <= x + w + 4 && clickY >= y - 4 && clickY <= y + h + 4;
      });

      const matchingImages = detectedImages.filter((img) => {
        const x = img.x * scaleX;
        const y = img.y * scaleY;
        const w = img.w * scaleX;
        const h = img.h * scaleY;
        return clickX >= x && clickX <= x + w && clickY >= y && clickY <= y + h;
      });

      const layers = [
        ...matchingSpans.map((s) => ({ type: 'span' as const, data: s })),
        ...matchingImages.map((i) => ({ type: 'image' as const, data: i })),
      ];

      if (layers.length === 1) {
        setOverlappingLayers(null);
        if (layers[0].type === 'span') {
          handleSpanClick(layers[0].data, e);
        } else {
          handleRemoveImage(layers[0].data, e);
        }
      } else if (layers.length > 1) {
        setOverlappingLayers(layers);
        setLayerPopupPos({ x: clickX, y: clickY });
      } else {
        setOverlappingLayers(null);
      }
    }
  };

  const handleSpanClick = (span: DetectedSpan, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSpan(span);
    setTextInput(span.text);
    setFontSize(Math.round((span.size || 12) * 10) / 10);
    setSelectedColor(span.color || '#f43f5e');
    setSelectedFont(span.font || 'Helvetica');
    setIsBold(!!span.isBold);
    setIsItalic(!!span.isItalic);
  };

  const handleApplyInPlaceTextEdit = () => {
    if (!editingSpan) return;
    const newAnno: EditAnnotation = {
      id: Math.random().toString(36).substring(2, 9),
      type: 'replace_text',
      page: currentPage,
      bbox: editingSpan.bbox,
      text: textInput,
      fontSize,
      color: selectedColor,
      font: selectedFont || editingSpan.font,
      isBold,
      isItalic,
    };

    // Filter out existing edits for this exact bounding box to update in place
    setAnnotations((prev) => [
      ...prev.filter((a) => !(a.type === 'replace_text' && a.bbox && a.bbox.join(',') === editingSpan.bbox.join(','))),
      newAnno
    ]);
    setEditingSpan(null);
    setTextInput('');
    toast({ title: 'Text Edit Applied ✨', description: `Updated text preview with ${selectedFont} ${fontSize}pt` });
  };

  const handleRemoveImage = (img: DetectedImage, e: React.MouseEvent) => {
    e.stopPropagation();
    const newAnno: EditAnnotation = {
      id: Math.random().toString(36).substring(2, 9),
      type: 'remove_image',
      page: currentPage,
      bbox: img.bbox,
    };
    setAnnotations((prev) => [...prev, newAnno]);
    toast({ title: 'Image Removal Queued 🗑️', description: 'Selected image area masked for removal.' });
  };

  const handleAddImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const imgFile = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      if (dataUrl) {
        const newAnno: EditAnnotation = {
          id: Math.random().toString(36).substring(2, 9),
          type: 'image',
          page: currentPage,
          x: 100 / scaleX,
          y: 100 / scaleY,
          w: 180 / scaleX,
          h: 120 / scaleY,
          imgData: dataUrl,
        };
        setAnnotations((prev) => [...prev, newAnno]);
        toast({ title: 'Image Stamp Added 🖼️', description: 'Placed image on page canvas.' });
      }
    };
    reader.readAsDataURL(imgFile);
  };

  const handleAddText = () => {
    if (!textInput.trim() || !textPosition) return;
    const pdfX = Math.round(textPosition.x / scaleX);
    const pdfY = Math.round(textPosition.y / scaleY);
    const newAnno: EditAnnotation = {
      id: Math.random().toString(36).substring(2, 9),
      type: 'text',
      page: currentPage,
      x: pdfX,
      y: pdfY,
      text: textInput.trim(),
      fontSize,
      color: selectedColor,
      font: selectedFont,
      isBold,
      isItalic,
    };
    setAnnotations((prev) => [...prev, newAnno]);
    setTextPosition(null);
    setTextInput('');
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'pen') return;
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setCurrentPenPoints([{ x: x / scaleX, y: y / scaleY }]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || activeTool !== 'pen' || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentPenPoints((prev) => [...prev, { x: x / scaleX, y: y / scaleY }]);
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPenPoints.length >= 2) {
      const newAnno: EditAnnotation = {
        id: Math.random().toString(36).substring(2, 9),
        type: 'pen',
        page: currentPage,
        color: selectedColor,
        points: currentPenPoints,
      };
      setAnnotations((prev) => [...prev, newAnno]);
    }
    setCurrentPenPoints([]);
  };

  const removeAnnotation = (id: string) => {
    setAnnotations(annotations.filter((a) => a.id !== id));
  };

  const handleSaveEditedPdf = async () => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('edits', JSON.stringify(annotations));

      const res = await fetch('/api/edit-pdf', { method: 'POST', body: formData });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        downloadBytes(bytes, `edited-${file.name}`);
        toast({ title: 'PDF Saved Successfully! ✍️', description: 'Applied high-fidelity PyMuPDF edits.' });
      } else {
        throw new Error('Server edit process failed');
      }
    } catch (err: any) {
      toast({ title: 'Error Saving PDF', description: err?.message || 'Operation failed', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper font family styling for live canvas preview
  const getCssFontFamily = (f: string = '') => {
    const fn = f.toLowerCase();
    if (fn.includes('times') || fn.includes('georgia') || fn.includes('serif')) return 'Georgia, "Times New Roman", serif';
    if (fn.includes('courier') || fn.includes('mono') || fn.includes('code')) return '"Courier New", Courier, monospace';
    return 'Arial, Helvetica, sans-serif';
  };

  return (
    <div className="fixed inset-0 z-[999] flex flex-col bg-slate-950 text-white font-sans overflow-hidden">
      {/* ── STUDIO TOP HEADER BAR ── */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 shadow-xl shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold transition"
          >
            <X className="w-4 h-4" /> Exit Studio
          </button>
          <div className="h-5 w-px bg-slate-800" />
          <h2 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
            {file.name}
          </h2>
        </div>

        {/* Center Page Nav & Zoom Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-700 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-300 px-2 min-w-[70px] text-center">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-700 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.15))}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-300 px-2">{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.15))}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Save & Download Action Button */}
        <button
          onClick={handleSaveEditedPdf}
          disabled={isProcessing || annotations.length === 0}
          className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-rose-600/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          {isProcessing ? 'Saving Edits...' : `Save & Download (${annotations.length})`}
        </button>
      </div>

      {/* ── TOOLBAR: INTERACTIVE FORMATTING CONTROLS ── */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-slate-900/90 border-b border-slate-800 shrink-0 flex-wrap gap-4">
        {/* Tool Mode Picker */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTool('inspect')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTool === 'inspect'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" /> Select & Edit
          </button>
          <button
            onClick={() => setActiveTool('text')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTool === 'text'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Type className="w-3.5 h-3.5" /> Add Text
          </button>
          <button
            onClick={() => setActiveTool('pen')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTool === 'pen'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" /> Draw Pen
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3.5 py-1.5 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition"
          >
            <ImageIcon className="w-3.5 h-3.5" /> Add Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAddImageFile}
          />
        </div>

        {/* Live Font & Color Formatting Palette */}
        <div className="flex items-center gap-3">
          {/* Color Palette Swatches */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            {['#f43f5e', '#2563eb', '#10b981', '#f59e0b', '#000000', '#ffffff'].map((c) => (
              <button
                key={c}
                onClick={() => setSelectedColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition ${
                  selectedColor === c ? 'border-white scale-110 shadow-md' : 'border-transparent opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-5 h-5 rounded-full bg-transparent border-0 cursor-pointer p-0"
              title="Custom Color"
            />
          </div>

          {/* Font Family Select */}
          <select
            value={selectedFont}
            onChange={(e) => setSelectedFont(e.target.value)}
            className="bg-slate-950 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-800 focus:outline-none focus:border-rose-500"
            title="Font Family"
          >
            <option value="Helvetica">Sans-Serif (Helvetica / Arial)</option>
            <option value="Times">Serif (Times / Georgia / Garamond)</option>
            <option value="Courier">Monospace (Courier / Consolas)</option>
          </select>

          {/* Font Size Select */}
          <select
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="bg-slate-950 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-800 focus:outline-none focus:border-rose-500"
          >
            {![8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48].includes(Math.round(fontSize)) && (
              <option value={fontSize}>{Math.round(fontSize * 10) / 10}pt (Original)</option>
            )}
            <option value={8}>8pt</option>
            <option value={9}>9pt</option>
            <option value={10}>10pt</option>
            <option value={11}>11pt</option>
            <option value={12}>12pt</option>
            <option value={14}>14pt</option>
            <option value={16}>16pt</option>
            <option value={18}>18pt</option>
            <option value={20}>20pt</option>
            <option value={24}>24pt</option>
            <option value={28}>28pt</option>
            <option value={32}>32pt</option>
            <option value={36}>36pt</option>
            <option value={48}>48pt</option>
          </select>

          {/* Bold & Italic Style Toggles */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setIsBold(!isBold)}
              className={`p-1.5 rounded-lg text-xs transition ${
                isBold ? 'bg-rose-600 text-white font-black' : 'text-slate-400 hover:text-white'
              }`}
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsItalic(!isItalic)}
              className={`p-1.5 rounded-lg text-xs transition ${
                isItalic ? 'bg-rose-600 text-white italic' : 'text-slate-400 hover:text-white'
              }`}
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN WORKSPACE: SIDEBAR PAGES + CENTER CANVAS + RIGHT INSPECTOR ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Thumbnails Sidebar */}
        <div className="w-48 bg-slate-900 border-r border-slate-800 p-4 overflow-y-auto hidden md:flex flex-col gap-3 shrink-0">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Pages ({totalPages})
          </div>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`p-2.5 rounded-xl text-left border text-xs font-bold transition flex items-center justify-between ${
                currentPage === p
                  ? 'bg-rose-600/20 border-rose-500 text-rose-400 shadow-md'
                  : 'bg-slate-800/60 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span>Page {p}</span>
              {currentPage === p && <Check className="w-3.5 h-3.5 text-rose-400" />}
            </button>
          ))}
        </div>

        {/* Center Interactive Canvas Workspace */}
        <div className="flex-1 overflow-auto p-8 flex justify-center items-start bg-slate-950/80">
          <div
            ref={containerRef}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="relative bg-white shadow-2xl rounded-lg border border-slate-800 cursor-crosshair transition-all duration-150"
            style={{ width: canvasDimensions.width, height: canvasDimensions.height }}
          >
            <canvas ref={canvasRef} className="block w-full h-full rounded-lg" />

            {/* Transparent Text Span Hover Highlights */}
            {activeTool === 'inspect' &&
              detectedSpans.map((span) => {
                const boxX = span.x * scaleX;
                const boxY = span.y * scaleY;
                const boxW = span.w * scaleX;
                const boxH = span.h * scaleY;

                return (
                  <div
                    key={span.id}
                    onClick={(e) => handleSpanClick(span, e)}
                    className="absolute z-10 border border-transparent hover:border-rose-500 hover:bg-rose-500/15 cursor-pointer rounded transition group"
                    style={{
                      left: boxX,
                      top: boxY,
                      width: Math.max(boxW, 20),
                      height: Math.max(boxH, 14),
                    }}
                    title={`Click to edit: "${span.text}" (${span.font}, ${span.size}pt)`}
                  />
                );
              })}

            {/* Embedded Image Hover Highlights */}
            {activeTool === 'inspect' &&
              detectedImages.map((img) => {
                const boxX = img.x * scaleX;
                const boxY = img.y * scaleY;
                const boxW = img.w * scaleX;
                const boxH = img.h * scaleY;

                return (
                  <div
                    key={img.id}
                    className="absolute z-10 border-2 border-dashed border-transparent hover:border-rose-500 bg-transparent hover:bg-rose-500/10 flex items-center justify-center group rounded transition"
                    style={{
                      left: boxX,
                      top: boxY,
                      width: boxW,
                      height: boxH,
                    }}
                  >
                    <button
                      onClick={(e) => handleRemoveImage(img, e)}
                      className="bg-rose-600 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow hover:bg-rose-700 transition opacity-0 group-hover:opacity-100"
                    >
                      Remove Image
                    </button>
                  </div>
                );
              })}

            {/* ── WYSIWYG REAL-TIME CANVAS ANNOTATIONS OVERLAY ── */}
            {annotations
              .filter((a) => a.page === currentPage)
              .map((anno) => {
                if (anno.type === 'replace_text' && anno.bbox) {
                  const boxX = anno.bbox[0] * scaleX;
                  const boxY = anno.bbox[1] * scaleY;
                  const boxW = (anno.bbox[2] - anno.bbox[0]) * scaleX;
                  const boxH = (anno.bbox[3] - anno.bbox[1]) * scaleY;

                  return (
                    <div
                      key={anno.id}
                      className="absolute z-20 flex items-center px-1 border border-rose-500/60 bg-white rounded shadow-sm group"
                      style={{
                        left: boxX,
                        top: boxY,
                        minWidth: Math.max(boxW, 30),
                        height: Math.max(boxH, 16),
                      }}
                    >
                      <span
                        style={{
                          fontSize: `${(anno.fontSize || 12) * scaleY}px`,
                          color: anno.color || '#f43f5e',
                          fontFamily: getCssFontFamily(anno.font),
                          fontWeight: anno.isBold ? 'bold' : 'normal',
                          fontStyle: anno.isItalic ? 'italic' : 'normal',
                          lineHeight: '1',
                        }}
                        className="truncate"
                      >
                        {anno.text}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAnnotation(anno.id);
                        }}
                        className="absolute -top-2 -right-2 bg-rose-600 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition shadow"
                        title="Remove Text Edit"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                }

                if (anno.type === 'remove_image' && anno.bbox) {
                  const boxX = anno.bbox[0] * scaleX;
                  const boxY = anno.bbox[1] * scaleY;
                  const boxW = (anno.bbox[2] - anno.bbox[0]) * scaleX;
                  const boxH = (anno.bbox[3] - anno.bbox[1]) * scaleY;

                  return (
                    <div
                      key={anno.id}
                      className="absolute z-20 bg-rose-500/20 border-2 border-dashed border-rose-500 rounded flex items-center justify-center group"
                      style={{ left: boxX, top: boxY, width: boxW, height: boxH }}
                    >
                      <span className="text-[10px] font-bold text-rose-500 bg-slate-900/80 px-2 py-0.5 rounded">
                        IMAGE REMOVED
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAnnotation(anno.id);
                        }}
                        className="absolute -top-2 -right-2 bg-slate-900 text-white p-1 rounded-full border border-slate-700 opacity-0 group-hover:opacity-100 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                }

                if (anno.type === 'image' && anno.imgData) {
                  const boxX = (anno.x || 50) * scaleX;
                  const boxY = (anno.y || 50) * scaleY;
                  const boxW = (anno.w || 150) * scaleX;
                  const boxH = (anno.h || 100) * scaleY;

                  return (
                    <div
                      key={anno.id}
                      className="absolute z-20 border border-slate-300 shadow-md group rounded"
                      style={{ left: boxX, top: boxY, width: boxW, height: boxH }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={anno.imgData} alt="Stamp" className="w-full h-full object-contain rounded" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAnnotation(anno.id);
                        }}
                        className="absolute -top-2 -right-2 bg-rose-600 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition shadow"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                }

                if (anno.type === 'text') {
                  const boxX = (anno.x || 50) * scaleX;
                  const boxY = (anno.y || 50) * scaleY;

                  return (
                    <div
                      key={anno.id}
                      className="absolute z-20 group flex items-center gap-1"
                      style={{ left: boxX, top: boxY }}
                    >
                      <span
                        style={{
                          fontSize: `${(anno.fontSize || 14) * scaleY}px`,
                          color: anno.color || '#f43f5e',
                          fontFamily: getCssFontFamily(anno.font),
                          fontWeight: anno.isBold ? 'bold' : 'normal',
                          fontStyle: anno.isItalic ? 'italic' : 'normal',
                        }}
                      >
                        {anno.text}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAnnotation(anno.id);
                        }}
                        className="bg-rose-600 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition shadow"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                }

                if (anno.type === 'pen' && anno.points) {
                  return (
                    <svg
                      key={anno.id}
                      className="absolute inset-0 pointer-events-none z-20 w-full h-full"
                    >
                      <polyline
                        fill="none"
                        stroke={anno.color || '#f43f5e'}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={anno.points.map((p) => `${p.x * scaleX},${p.y * scaleY}`).join(' ')}
                      />
                    </svg>
                  );
                }

                return null;
              })}

            {/* Overlapping Layers Selection Modal */}
            {overlappingLayers && layerPopupPos && (
              <div
                className="absolute z-40 bg-slate-950 border-2 border-rose-500 p-4 rounded-2xl shadow-2xl flex flex-col gap-3 min-w-[260px]"
                style={{ left: layerPopupPos.x, top: layerPopupPos.y }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                    <Layers className="w-4 h-4" /> Select Overlapping Layer
                  </div>
                  <button onClick={() => setOverlappingLayers(null)} className="text-slate-400 hover:text-white p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                  {overlappingLayers.map((layer, idx) => (
                    <button
                      key={idx}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (layer.type === 'span') {
                          handleSpanClick(layer.data, e);
                        } else {
                          handleRemoveImage(layer.data, e);
                        }
                        setOverlappingLayers(null);
                      }}
                      className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/50 text-left transition"
                    >
                      <Type className="w-4 h-4 text-rose-400 shrink-0" />
                      <span className="text-xs text-white truncate">
                        {layer.type === 'span' ? `"${layer.data.text}"` : 'Embedded Image'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 4. RIGHT SIDEBAR: INTERACTIVE FORMATTING INSPECTOR ── */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 p-5 flex flex-col justify-between shrink-0 shadow-2xl overflow-y-auto">
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-rose-500" /> Formatting Inspector
              </h3>
              <span className="text-[11px] text-slate-400 font-semibold">
                {annotations.filter((a) => a.page === currentPage).length} Edits
              </span>
            </div>

            {/* Active Text Editing Box */}
            {editingSpan ? (
              <div className="bg-slate-950 border-2 border-rose-500/80 rounded-2xl p-4 space-y-3.5 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Edit Selected Text
                  </span>
                  <button onClick={() => setEditingSpan(null)} className="text-slate-500 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-medium block mb-1">Text Content</label>
                  <input
                    type="text"
                    autoFocus
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyInPlaceTextEdit()}
                    className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-rose-500 font-sans"
                    placeholder="Enter replacement text..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium block mb-1">Font Size</label>
                    <input
                      type="number"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full bg-slate-900 text-white text-xs px-3 py-1.5 rounded-xl border border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium block mb-1">Font Family</label>
                    <select
                      value={selectedFont}
                      onChange={(e) => setSelectedFont(e.target.value)}
                      className="w-full bg-slate-900 text-white text-xs px-2 py-1.5 rounded-xl border border-slate-700"
                    >
                      <option value="Helvetica">Sans-Serif</option>
                      <option value="Times">Serif</option>
                      <option value="Courier">Monospace</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleApplyInPlaceTextEdit}
                  className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Apply Live Preview
                </button>
              </div>
            ) : (
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl text-center text-slate-400 text-xs">
                <MousePointer className="w-6 h-6 mx-auto mb-2 text-rose-500/60" />
                <p className="font-semibold text-slate-300">Click any text or image on canvas to inspect & edit</p>
                <p className="text-[11px] text-slate-500 mt-1">Live changes render instantly on preview</p>
              </div>
            )}

            {/* List of Applied Edits */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Applied Page Edits ({annotations.filter((a) => a.page === currentPage).length})
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {annotations
                  .filter((a) => a.page === currentPage)
                  .map((anno) => (
                    <div
                      key={anno.id}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs transition hover:border-slate-700"
                    >
                      <div className="truncate mr-2">
                        <span className="font-bold text-rose-400 uppercase text-[10px] block">
                          {anno.type.replace('_', ' ')}
                        </span>
                        <span className="text-slate-200 font-medium truncate block">
                          {anno.text || anno.label || 'Modified object'}
                        </span>
                      </div>
                      <button
                        onClick={() => removeAnnotation(anno.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Delete Edit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              onClick={handleSaveEditedPdf}
              disabled={isProcessing || annotations.length === 0}
              className="w-full py-3 bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white rounded-xl font-extrabold text-xs shadow-lg shadow-rose-600/30 transition disabled:opacity-40"
            >
              Save & Download Final PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
