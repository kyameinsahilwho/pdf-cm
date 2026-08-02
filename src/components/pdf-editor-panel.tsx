'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Type, Edit3, Square, Download, Trash2, Check, RefreshCw, Crosshair,
  Image as ImageIcon, ZoomIn, ZoomOut, Maximize2, X, ChevronLeft, ChevronRight,
  Eye, MousePointer, Layers
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
  isSuper?: boolean;
  style?: string;
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
  style?: string;
  isBold?: boolean;
  isItalic?: boolean;
  isSuper?: boolean;
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
  const [activeTool, setActiveTool] = useState<'inspect' | 'text' | 'pen' | 'image'>('inspect');
  const [selectedColor, setSelectedColor] = useState('#f43f5e');
  const [fontSize, setFontSize] = useState(16);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1.3);
  const [annotations, setAnnotations] = useState<EditAnnotation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Native PDF Page Dimensions & Canvas Dimensions for 100% Exact Bounding Box Alignment
  const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number }>({ width: 612, height: 792 });
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({ width: 795, height: 1030 });

  // Inspection & Layer Disambiguation State
  const [detectedSpans, setDetectedSpans] = useState<DetectedSpan[]>([]);
  const [detectedImages, setDetectedImages] = useState<DetectedImage[]>([]);
  const [inspecting, setInspecting] = useState(false);
  const [editingSpan, setEditingSpan] = useState<DetectedSpan | null>(null);
  const [overlappingLayers, setOverlappingLayers] = useState<Array<{ type: 'span' | 'image'; data: any }> | null>(null);
  const [layerPopupPos, setLayerPopupPos] = useState<{ x: number; y: number } | null>(null);

  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPenPoints, setCurrentPenPoints] = useState<Array<{ x: number; y: number }>>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Render PDF Page with dynamic zoom level
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

  // Inspect page text & image elements via Python PyMuPDF backend API
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
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (activeTool === 'text') {
      const pdfX = clickX / scaleX;
      const pdfY = clickY / scaleY;
      setTextPosition({ x: clickX, y: clickY });
      setTextInput('');
    } else if (activeTool === 'inspect') {
      // Find all overlapping text spans and images at click location
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
    setFontSize(span.size);
    setSelectedColor(span.color);
  };

  const handleApplyInPlaceTextEdit = () => {
    if (!editingSpan) return;
    const newAnno: EditAnnotation = {
      id: Math.random().toString(36).substring(2, 9),
      type: 'replace_text',
      page: currentPage,
      bbox: editingSpan.bbox,
      text: textInput.trim(),
      fontSize,
      color: selectedColor,
      font: editingSpan.font,
      isBold: editingSpan.isBold,
      isItalic: editingSpan.isItalic,
      isSuper: editingSpan.isSuper,
      style: editingSpan.style,
    };
    setAnnotations((prev) => [...prev, newAnno]);
    setEditingSpan(null);
    setTextInput('');
    toast({ title: 'Text Edit Queued ✏️', description: `Replacing "${editingSpan.text}" with "${textInput}" (${editingSpan.font} ${editingSpan.style || ''})` });
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
    toast({ title: 'Image Removal Queued 🗑️', description: 'Selected image object will be removed.' });
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
        toast({ title: 'Image Stamp Added 🖼️', description: 'Placed new image on current page.' });
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
        toast({ title: 'PDF Saved! ✍️', description: 'Applied high-fidelity PyMuPDF edits.' });
      } else {
        throw new Error('Server edit process failed');
      }
    } catch (err: any) {
      toast({ title: 'Error Saving PDF', description: err?.message || 'Operation failed', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex flex-col bg-slate-950 text-white font-sans overflow-hidden">
      {/* Studio Header Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 shadow-xl shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium transition"
          >
            <X className="w-4 h-4" /> Exit Studio
          </button>
          <div className="h-5 w-px bg-slate-800" />
          <h2 className="text-base font-bold text-white truncate max-w-md">
            {file.name}
          </h2>
        </div>

        {/* Center Page Nav & Zoom Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 text-slate-300 hover:text-white disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold px-2 text-slate-200">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 text-slate-300 hover:text-white disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
              className="p-1.5 text-slate-300 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold px-2 text-slate-200 min-w-[50px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
              className="p-1.5 text-slate-300 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(1.3)}
              className="p-1.5 text-slate-400 hover:text-white text-xs px-2 font-mono"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Right Export Button */}
        <button
          onClick={handleSaveEditedPdf}
          disabled={isProcessing}
          className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white px-5 py-2 rounded-xl font-bold text-sm shadow-xl transition transform hover:scale-[1.02]"
        >
          {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Save & Export PDF
        </button>
      </div>

      {/* Floating Tool Controls Bar */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-slate-900/90 backdrop-blur border-b border-slate-800/80 shrink-0 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTool('inspect')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTool === 'inspect'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Crosshair className="w-4 h-4" /> Detect Text & Images
          </button>
          <button
            onClick={() => setActiveTool('text')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTool === 'text'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Type className="w-4 h-4" /> Add Text
          </button>
          <button
            onClick={() => setActiveTool('pen')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTool === 'pen'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Edit3 className="w-4 h-4" /> Draw Pen
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition"
          >
            <ImageIcon className="w-4 h-4" /> Add Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAddImageFile}
          />
        </div>

        {/* Colors & Fonts */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
            {['#f43f5e', '#2563eb', '#10b981', '#f59e0b', '#1f2937', '#ffffff'].map((c) => (
              <button
                key={c}
                onClick={() => setSelectedColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition ${
                  selectedColor === c ? 'border-white scale-110 shadow-md' : 'border-transparent opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <select
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="bg-slate-800 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 focus:outline-none"
          >
            <option value={10}>10pt</option>
            <option value={12}>12pt</option>
            <option value={14}>14pt</option>
            <option value={16}>16pt</option>
            <option value={20}>20pt</option>
            <option value={24}>24pt</option>
            <option value={32}>32pt</option>
          </select>
        </div>
      </div>

      {/* Main Studio Workspace: Sidebar Thumbnails + Center Scrollable Canvas */}
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

        {/* Center Workspace Canvas */}
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

            {/* 100% Pixel-Perfect Text Bounding Boxes */}
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
                    className="absolute z-10 border border-rose-500/50 bg-rose-500/10 hover:border-rose-600 hover:bg-rose-500/30 cursor-pointer rounded transition group"
                    style={{
                      left: boxX,
                      top: boxY,
                      width: Math.max(boxW, 20),
                      height: Math.max(boxH, 14),
                    }}
                    title={`Detected: "${span.text}" (${span.font}, ${span.size}pt, ${span.color})`}
                  />
                );
              })}

            {/* 100% Pixel-Perfect Image Bounding Boxes */}
            {activeTool === 'inspect' &&
              detectedImages.map((img) => {
                const boxX = img.x * scaleX;
                const boxY = img.y * scaleY;
                const boxW = img.w * scaleX;
                const boxH = img.h * scaleY;

                return (
                  <div
                    key={img.id}
                    className="absolute z-10 border-2 border-dashed border-rose-500/80 hover:border-rose-600 bg-rose-500/10 flex items-center justify-center group rounded"
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

            {/* Overlapping Layers Selector Disambiguation Modal */}
            {overlappingLayers && layerPopupPos && (
              <div
                className="absolute z-40 bg-slate-950 border-2 border-rose-500 p-4 rounded-2xl shadow-2xl flex flex-col gap-3 min-w-[280px]"
                style={{ left: layerPopupPos.x, top: layerPopupPos.y }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                    <Layers className="w-4 h-4" /> Multiple Layers ({overlappingLayers.length})
                  </div>
                  <button
                    onClick={() => setOverlappingLayers(null)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs font-medium text-slate-300">Which layer do you want to select?</p>

                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {overlappingLayers.map((layer, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        if (layer.type === 'span') {
                          handleSpanClick(layer.data, e);
                        } else {
                          handleRemoveImage(layer.data, e);
                        }
                        setOverlappingLayers(null);
                      }}
                      className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/50 text-left transition group"
                    >
                      <div className="w-6 h-6 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5">
                        {layer.type === 'span' ? <Type className="w-3.5 h-3.5 text-rose-400" /> : <ImageIcon className="w-3.5 h-3.5 text-rose-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        {layer.type === 'span' ? (
                          <>
                            <p className="text-xs font-bold text-white truncate group-hover:text-rose-300">
                              "{layer.data.text}"
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {layer.data.font} · {layer.data.size}pt {layer.data.style ? `[${layer.data.style}]` : ''}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-bold text-white group-hover:text-rose-300">
                              Embedded Image Layer
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {Math.round(layer.data.w)}x{Math.round(layer.data.h)} px
                            </p>
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* In-Place Text Edit Modal Box */}
            {editingSpan && (
              <div
                className="absolute z-30 bg-slate-950 border-2 border-rose-500 p-3.5 rounded-xl shadow-2xl flex flex-col gap-2.5 min-w-[240px]"
                style={{ left: editingSpan.x * scaleX, top: editingSpan.y * scaleY }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-xs text-rose-400 font-bold flex items-center justify-between gap-2">
                  <span>Edit Text ({editingSpan.font}, {editingSpan.size}pt)</span>
                  {editingSpan.style && (
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-mono">
                      {editingSpan.style}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  autoFocus
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyInPlaceTextEdit()}
                  className="bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-rose-500"
                />
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    onClick={handleApplyInPlaceTextEdit}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs px-3.5 py-1.5 rounded-lg font-bold transition"
                  >
                    Replace Text
                  </button>
                  <button
                    onClick={() => setEditingSpan(null)}
                    className="text-slate-400 text-xs hover:text-white px-2 py-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Add Text Input Box */}
            {textPosition && activeTool === 'text' && (
              <div
                className="absolute z-30 bg-slate-900 border border-rose-500 p-2 rounded-xl shadow-2xl flex items-center gap-2"
                style={{ left: textPosition.x, top: textPosition.y }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  autoFocus
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddText()}
                  placeholder="Type text overlay..."
                  className="bg-slate-800 text-white text-sm px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none"
                />
                <button
                  onClick={handleAddText}
                  className="bg-rose-600 text-white p-1.5 rounded-lg hover:bg-rose-700 transition"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Active Annotations Render Overlay */}
            {annotations
              .filter((a) => a.page === currentPage)
              .map((anno) => {
                const renderX = (anno.x || (anno.bbox ? anno.bbox[0] : 50)) * scaleX;
                const renderY = (anno.y || (anno.bbox ? anno.bbox[1] : 50)) * scaleY;

                return (
                  <div
                    key={anno.id}
                    className="absolute z-20 group"
                    style={{ left: renderX, top: renderY }}
                  >
                    {anno.type === 'replace_text' && (
                      <span className="bg-rose-600/90 text-white text-xs px-2 py-1 rounded-md font-mono shadow">
                        Replace: "{anno.text}"
                      </span>
                    )}
                    {anno.type === 'remove_image' && (
                      <span className="bg-rose-600/90 text-white text-xs px-2 py-1 rounded-md shadow">
                        [Image Removed]
                      </span>
                    )}
                    {anno.type === 'text' && (
                      <span
                        className="font-sans font-semibold cursor-move select-none px-1 rounded"
                        style={{ fontSize: `${(anno.fontSize || 14) * scaleY}px`, color: anno.color }}
                      >
                        {anno.text}
                      </span>
                    )}
                    {anno.type === 'image' && anno.imgData && (
                      <img
                        src={anno.imgData}
                        alt="Stamp"
                        style={{ width: (anno.w || 180) * scaleX, height: (anno.h || 120) * scaleY }}
                        className="rounded shadow-lg"
                      />
                    )}
                    <button
                      onClick={() => setAnnotations((prev) => prev.filter((a) => a.id !== anno.id))}
                      className="opacity-0 group-hover:opacity-100 absolute -top-3 -right-3 bg-rose-600 text-white p-1 rounded-full shadow-lg hover:bg-rose-700 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
