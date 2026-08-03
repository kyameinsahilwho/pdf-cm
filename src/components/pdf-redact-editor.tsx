'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  EyeOff, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw,
  Sparkles, Trash2, Check, Download, ShieldAlert, Layers, Crosshair,
  X, RefreshCw, Eye, MousePointer, ShieldCheck, FileText, Info
} from 'lucide-react';
import { applyRedactions, scanPdfForSensitiveText, type RedactionArea } from '@/lib/engines/redact-engine';
import { downloadBytes } from '@/lib/engines/core-pdf-engine';
import { useToast } from '@/hooks/use-toast';

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

export function PdfRedactEditor({ file, onBack }: { file: File; onBack?: () => void }) {
  const { toast } = useToast();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Active Tool Mode: 'inspect' (Click-to-redact text/images) or 'draw' (Manual box selection)
  const [activeTool, setActiveTool] = useState<'inspect' | 'draw'>('inspect');

  // Page Nav & Zoom State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1.3);

  // PDF Page & Canvas Coordinate Mapping Dimensions
  const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number }>({ width: 612, height: 792 });
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({ width: 795, height: 1030 });

  // Inspection State via PyMuPDF backend
  const [detectedSpans, setDetectedSpans] = useState<DetectedSpan[]>([]);
  const [detectedImages, setDetectedImages] = useState<DetectedImage[]>([]);
  const [inspecting, setInspecting] = useState(false);
  const [hoveredSpan, setHoveredSpan] = useState<DetectedSpan | null>(null);
  const [hoveredImage, setHoveredImage] = useState<DetectedImage | null>(null);

  // Redaction Items & Style State
  const [redactions, setRedactions] = useState<RedactionArea[]>([]);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [labelText, setLabelText] = useState('[REDACTED]');

  // Drawing state for drag-to-draw custom box
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);

  // Overlapping layer selection popup
  const [overlappingLayers, setOverlappingLayers] = useState<Array<{ type: 'span' | 'image'; data: any }> | null>(null);
  const [layerPopupPos, setLayerPopupPos] = useState<{ x: number; y: number } | null>(null);

  const [processing, setProcessing] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Render PDF Page to Canvas via unpdf engine
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
        console.error('[PdfRedactEditor] Page render error:', err);
      }
    }
    renderPage();
    return () => { active = false; };
  }, [file, currentPage, zoomLevel]);

  // Fetch page elements for click-to-redact inspection via PyMuPDF backend API
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
        console.warn('[PdfRedactEditor] PyMuPDF element inspection unavailable:', err);
      } finally {
        if (active) setInspecting(false);
      }
    }
    fetchElements();
    return () => { active = false; };
  }, [file, currentPage]);

  // Coordinate conversion factors for 100% exact alignment between Canvas and PDF points
  const scaleX = pdfDimensions.width > 0 ? canvasDimensions.width / pdfDimensions.width : 1;
  const scaleY = pdfDimensions.height > 0 ? canvasDimensions.height / pdfDimensions.height : 1;

  // Add a new Redaction Box Area
  const addRedactionArea = (x: number, y: number, width: number, height: number, customLabel?: string) => {
    const newRedaction: RedactionArea = {
      id: `redact-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      page: currentPage,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      color: selectedColor,
      label: customLabel !== undefined ? customLabel : labelText,
    };
    setRedactions((prev) => [...prev, newRedaction]);
  };

  // Canvas Mouse Down Handler
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (overlappingLayers) {
      setOverlappingLayers(null);
      return;
    }

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (activeTool === 'draw') {
      setIsDrawing(true);
      setStartPos({ x: clickX, y: clickY });
      setCurrentPos({ x: clickX, y: clickY });
    } else if (activeTool === 'inspect') {
      // Find all matching text spans & images at click location
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
          const s = layers[0].data as DetectedSpan;
          addRedactionArea(s.x, s.y, s.w, s.h);
          toast({ title: 'Text Redacted 🚫', description: `Covered "${s.text.substring(0, 30)}..."` });
        } else {
          const img = layers[0].data as DetectedImage;
          addRedactionArea(img.x, img.y, img.w, img.h, '[IMAGE REDACTED]');
          toast({ title: 'Image Redacted 🖼️', description: 'Covered image object area.' });
        }
      } else if (layers.length > 1) {
        setOverlappingLayers(layers);
        setLayerPopupPos({ x: clickX, y: clickY });
      } else {
        setOverlappingLayers(null);
      }
    }
  };

  // Canvas Mouse Move Handler (updates drawing preview and hover state)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (isDrawing && activeTool === 'draw') {
      setCurrentPos({ x: clickX, y: clickY });
      return;
    }

    if (activeTool === 'inspect') {
      const span = detectedSpans.find((s) => {
        const x = s.x * scaleX;
        const y = s.y * scaleY;
        const w = s.w * scaleX;
        const h = s.h * scaleY;
        return clickX >= x - 2 && clickX <= x + w + 2 && clickY >= y - 2 && clickY <= y + h + 2;
      });
      setHoveredSpan(span || null);

      if (!span) {
        const img = detectedImages.find((i) => {
          const x = i.x * scaleX;
          const y = i.y * scaleY;
          const w = i.w * scaleX;
          const h = i.h * scaleY;
          return clickX >= x && clickX <= x + w && clickY >= y && clickY <= y + h;
        });
        setHoveredImage(img || null);
      } else {
        setHoveredImage(null);
      }
    }
  };

  // Mouse Up Handler for completing manual box draw
  const handleMouseUp = () => {
    if (!isDrawing || !startPos || !currentPos) {
      setIsDrawing(false);
      return;
    }

    const drawX = Math.min(startPos.x, currentPos.x);
    const drawY = Math.min(startPos.y, currentPos.y);
    const drawW = Math.abs(currentPos.x - startPos.x);
    const drawH = Math.abs(currentPos.y - startPos.y);

    setIsDrawing(false);
    setStartPos(null);
    setCurrentPos(null);

    // Filter tiny unintentional clicks
    if (drawW < 6 || drawH < 6) return;

    const pdfX = drawX / scaleX;
    const pdfY = drawY / scaleY;
    const pdfW = drawW / scaleX;
    const pdfH = drawH / scaleY;

    addRedactionArea(pdfX, pdfY, pdfW, pdfH);
    toast({ title: 'Redaction Area Added ⬛', description: `Covered area on Page ${currentPage}.` });
  };

  const removeRedaction = (id: string) => {
    setRedactions((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAutoScan = async () => {
    setScanning(true);
    try {
      const foundAreas = await scanPdfForSensitiveText(file);
      if (foundAreas.length === 0) {
        toast({ title: 'No Sensitive Patterns Found', description: 'Scanned SSN, email, phone, & credential patterns.' });
      } else {
        setRedactions((prev) => [...prev, ...foundAreas]);
        toast({ title: 'Auto-Scan Complete! ✨', description: `Detected ${foundAreas.length} sensitive pattern(s) across document.` });
      }
    } catch (err: any) {
      toast({ title: 'Scan Error', description: err.message, variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  };

  const handleApplyAndDownload = async () => {
    if (redactions.length === 0) {
      toast({ title: 'No Redactions Selected', description: 'Please add at least one redaction box on the PDF preview first.', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      const bytes = await applyRedactions(file, redactions);
      downloadBytes(bytes, `redacted-${file.name}`);
      toast({ title: 'PDF Sanitized & Redacted Successfully! 🛡️', description: `Permanently burned ${redactions.length} redaction area(s) with PyMuPDF stream purging.` });
    } catch (err: any) {
      toast({ title: 'Redaction Burning Failed', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  // Filter redactions for current page
  const currentPageRedactions = redactions.filter((r) => r.page === currentPage);

  return (
    <div className="fixed inset-0 z-[999] flex flex-col bg-slate-950 text-white font-sans overflow-hidden">
      {/* ── 1. STUDIO HEADER BAR ── */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 shadow-xl shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium transition"
          >
            <X className="w-4 h-4" /> Exit Studio
          </button>
          <div className="h-5 w-px bg-slate-800" />
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-rose-500" />
            <h2 className="text-base font-bold text-white truncate max-w-md">
              {file.name}
            </h2>
            <span className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wide hidden sm:inline-block">
              PyMuPDF Stream Sanitizer
            </span>
          </div>
        </div>

        {/* Page Nav & Zoom Controls */}
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

        {/* Export Redacted PDF Action */}
        <button
          onClick={handleApplyAndDownload}
          disabled={processing || redactions.length === 0}
          className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl font-bold text-sm shadow-xl transition transform hover:scale-[1.02]"
        >
          {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Save & Export Redacted PDF
        </button>
      </div>

      {/* ── 2. FLOATING MODE & CONTROL TOOLBAR ── */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-slate-900/90 backdrop-blur border-b border-slate-800/80 shrink-0 flex-wrap gap-4">
        {/* Tool Mode Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTool('inspect')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTool === 'inspect'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Crosshair className="w-4 h-4" /> Click-to-Redact Text & Images
          </button>
          <button
            onClick={() => setActiveTool('draw')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTool === 'draw'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <EyeOff className="w-4 h-4" /> Draw Redaction Box
          </button>

          <div className="h-5 w-px bg-slate-800 mx-1" />

          <button
            onClick={handleAutoScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-xl text-sm font-semibold transition"
          >
            <Sparkles className="w-4 h-4 text-rose-400" />
            {scanning ? 'Scanning PDF...' : 'Auto-Scan Sensitive Data'}
          </button>
        </div>

        {/* Color & Label Options */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">Box Style:</span>
            <div className="flex items-center gap-1.5">
              {[
                { label: 'Blackout', color: '#000000' },
                { label: 'Whiteout', color: '#ffffff' },
                { label: 'Red Alert', color: '#f43f5e' },
                { label: 'Slate', color: '#1e293b' },
              ].map((c) => (
                <button
                  key={c.color}
                  onClick={() => setSelectedColor(c.color)}
                  style={{ backgroundColor: c.color }}
                  title={c.label}
                  className={`w-6 h-6 rounded-full border transition-all ${
                    selectedColor === c.color ? 'border-amber-400 ring-2 ring-amber-400/40 scale-110' : 'border-white/20'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="h-5 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">Label:</span>
            <input
              type="text"
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              placeholder="e.g. [REDACTED]"
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs text-white w-32 focus:outline-none focus:border-rose-500"
            />
          </div>

          {redactions.length > 0 && (
            <button
              onClick={() => setRedactions([])}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 hover:underline transition"
            >
              Clear All ({redactions.length})
            </button>
          )}
        </div>
      </div>

      {/* ── 3. MAIN WORKSPACE: CANVAS + SIDEBAR ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* CANVAS PREVIEW AREA */}
        <div className="flex-1 bg-slate-950 overflow-auto p-8 flex justify-center items-start relative select-none">
          {inspecting && (
            <div className="absolute top-4 left-4 z-20 bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-300 flex items-center gap-2 backdrop-blur shadow-md">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
              Scanning elements for PyMuPDF inspection...
            </div>
          )}

          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`relative rounded-xl border border-slate-800 shadow-2xl overflow-hidden bg-white ${
              activeTool === 'inspect' ? 'cursor-pointer' : 'cursor-crosshair'
            }`}
            style={{
              width: canvasDimensions.width,
              height: canvasDimensions.height,
            }}
          >
            {/* Rendered PDF Page */}
            <canvas ref={canvasRef} className="block w-full h-full" />

            {/* OVERLAY: Detected Spans & Images Highlights (Inspect Mode) */}
            {activeTool === 'inspect' && (
              <>
                {detectedSpans.map((span) => {
                  const x = span.x * scaleX;
                  const y = span.y * scaleY;
                  const w = span.w * scaleX;
                  const h = span.h * scaleY;
                  const isHovered = hoveredSpan?.id === span.id;

                  return (
                    <div
                      key={span.id}
                      className={`absolute pointer-events-none transition-all ${
                        isHovered
                          ? 'border-2 border-rose-500 bg-rose-500/20 shadow-md scale-[1.01]'
                          : 'border border-blue-400/20 bg-blue-400/5 hover:border-rose-400'
                      }`}
                      style={{
                        left: `${x - 2}px`,
                        top: `${y - 2}px`,
                        width: `${w + 4}px`,
                        height: `${h + 4}px`,
                      }}
                    />
                  );
                })}

                {detectedImages.map((img) => {
                  const x = img.x * scaleX;
                  const y = img.y * scaleY;
                  const w = img.w * scaleX;
                  const h = img.h * scaleY;
                  const isHovered = hoveredImage?.id === img.id;

                  return (
                    <div
                      key={img.id}
                      className={`absolute pointer-events-none transition-all ${
                        isHovered
                          ? 'border-2 border-amber-500 bg-amber-500/20 shadow-md'
                          : 'border border-amber-400/25 bg-amber-400/5'
                      }`}
                      style={{
                        left: `${x}px`,
                        top: `${y}px`,
                        width: `${w}px`,
                        height: `${h}px`,
                      }}
                    />
                  );
                })}
              </>
            )}

            {/* OVERLAY: Active Redaction Boxes for Current Page */}
            {currentPageRedactions.map((r) => {
              const cX = r.x * scaleX;
              const cY = r.y * scaleY;
              const cW = r.width * scaleX;
              const cH = r.height * scaleY;

              return (
                <div
                  key={r.id}
                  className="absolute pointer-events-auto border-2 border-rose-500/80 shadow-lg flex items-center justify-center group"
                  style={{
                    left: `${cX}px`,
                    top: `${cY}px`,
                    width: `${cW}px`,
                    height: `${cH}px`,
                    backgroundColor: r.color || '#000000',
                  }}
                >
                  {r.label && (
                    <span
                      className={`font-bold uppercase tracking-wider text-[11px] truncate px-1 ${
                        r.color === '#ffffff' ? 'text-black' : 'text-white'
                      }`}
                    >
                      {r.label}
                    </span>
                  )}

                  {/* Remove Button on Hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRedaction(r.id);
                    }}
                    className="absolute -top-3 -right-3 w-6 h-6 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md"
                    title="Remove Redaction"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            {/* OVERLAY: Active Drag-to-Draw Preview Box */}
            {isDrawing && startPos && currentPos && (
              <div
                className="absolute border-2 border-dashed border-rose-500 bg-rose-500/30 pointer-events-none"
                style={{
                  left: `${Math.min(startPos.x, currentPos.x)}px`,
                  top: `${Math.min(startPos.y, currentPos.y)}px`,
                  width: `${Math.abs(currentPos.x - startPos.x)}px`,
                  height: `${Math.abs(currentPos.y - startPos.y)}px`,
                }}
              />
            )}

            {/* Overlapping Layer Popup */}
            {overlappingLayers && layerPopupPos && (
              <div
                className="absolute z-40 bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl space-y-2 min-w-[220px]"
                style={{ left: `${layerPopupPos.x + 10}px`, top: `${layerPopupPos.y + 10}px` }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-xs font-bold text-slate-300">
                  <span>Select Layer to Redact</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOverlappingLayers(null);
                    }}
                    className="text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
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
                          addRedactionArea(layer.data.x, layer.data.y, layer.data.w, layer.data.h);
                          toast({ title: 'Text Redacted 🚫', description: `Covered "${layer.data.text.substring(0, 30)}..."` });
                        } else {
                          addRedactionArea(layer.data.x, layer.data.y, layer.data.w, layer.data.h, '[IMAGE REDACTED]');
                          toast({ title: 'Image Redacted 🖼️', description: 'Covered image object area.' });
                        }
                        setOverlappingLayers(null);
                      }}
                      className="w-full text-left p-2 rounded-lg bg-slate-800 hover:bg-rose-600/30 hover:border-rose-500 border border-slate-700 text-xs text-slate-200 truncate transition"
                    >
                      {layer.type === 'span' ? `Text: "${layer.data.text.substring(0, 25)}..."` : `Image (${Math.round(layer.data.w)}x${Math.round(layer.data.h)})`}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── 4. RIGHT SIDEBAR: ACTIVE REDACTIONS MANAGER ── */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 p-5 flex flex-col justify-between shrink-0 shadow-2xl overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-rose-400" /> Active Redactions ({redactions.length})
              </span>
              {redactions.length > 0 && (
                <button
                  onClick={() => setRedactions([])}
                  className="text-xs font-semibold text-rose-400 hover:text-rose-300 hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            {redactions.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  No redactions added yet.<br />
                  Click on text/images or drag mouse over preview to redact.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                {redactions.map((r, idx) => (
                  <div
                    key={r.id}
                    onClick={() => setCurrentPage(r.page)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                      r.page === currentPage
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-200 shadow-md'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 font-bold">
                        <span
                          className="w-3 h-3 rounded-full border border-white/30 inline-block shrink-0"
                          style={{ backgroundColor: r.color || '#000000' }}
                        />
                        <span>Page {r.page} Area #{idx + 1}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRedaction(r.id);
                        }}
                        className="text-slate-400 hover:text-rose-400 p-1 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-400 space-y-0.5">
                      <p>Label: <strong className="text-slate-200">{r.label || 'None'}</strong></p>
                      <p className="font-mono text-[10px]">Position: ({r.x}, {r.y}) • Size: {r.width}×{r.height} pt</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Security Guarantee Badge */}
          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-2">
            <div className="flex items-start gap-2 bg-slate-800/80 p-3 rounded-xl border border-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="leading-normal">
                <strong>PyMuPDF Sanitization</strong> permanently purges stream content objects so text cannot be copied or recovered.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
