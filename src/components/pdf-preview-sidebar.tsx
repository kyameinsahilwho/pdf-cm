'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Eye, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw,
  Sparkles, ShieldCheck, Lock, Unlock, Crop, FileText, CheckCircle2,
  Sliders, Layers, RefreshCw
} from 'lucide-react';
import { renderPageToCanvas, PageViewportInfo } from '@/lib/engines/pdf-renderer-engine';
import { formatFileSize } from '@/lib/engines/pdf-renderer-engine';
import { extractHtmlBlocks } from '@/lib/engines/html-to-pdf-layout';

interface WatermarkConfig {
  text: string;
  color: string;
  size: number;
  opacity: number;
  angle: number;
}

interface PageNumConfig {
  position: 'bottom-right' | 'bottom-center' | 'bottom-left' | 'top-right';
  format: 'number' | 'page_n_of_m';
  color: string;
}

interface CropMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface PdfPreviewSidebarProps {
  file?: File;
  files?: File[];
  toolId: string;
  toolName: string;
  rotationAngle?: number;
  watermarkConfig?: WatermarkConfig;
  pageNumConfig?: PageNumConfig;
  cropMargins?: CropMargins;
  password?: string;
  compressLevel?: string;
  htmlContent?: string;
}

export function PdfPreviewSidebar({
  file,
  files = [],
  toolId,
  toolName,
  rotationAngle = 0,
  watermarkConfig,
  pageNumConfig,
  cropMargins,
  password,
  compressLevel,
  htmlContent,
}: PdfPreviewSidebarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(100); // percentage
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewportInfo, setViewportInfo] = useState<PageViewportInfo | null>(null);

  const activeFile = file || (files.length > 0 ? files[0] : undefined);
  const htmlPreviewBlocks = toolId === 'html-to-pdf' && !activeFile
    ? (() => {
        try {
          return extractHtmlBlocks(htmlContent || '');
        } catch {
          return [];
        }
      })()
    : [];

  // Render Page on Canvas when file or page changes
  useEffect(() => {
    if (!activeFile || activeFile.type.startsWith('image/')) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const scale = (zoom / 100) * 1.1;

    if (canvasRef.current) {
      renderPageToCanvas(activeFile, currentPage, canvasRef.current, scale)
        .then((info) => {
          if (!cancelled) {
            setViewportInfo(info);
            setTotalPages(info.pageCount);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err?.message || 'Failed to render PDF page');
            setLoading(false);
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [activeFile, currentPage, zoom]);

  // Page Navigation Handlers
  const prevPage = () => setCurrentPage((p) => Math.max(1, p - 1));
  const nextPage = () => setCurrentPage((p) => Math.min(totalPages, p + 1));
  const zoomIn = () => setZoom((z) => Math.min(200, z + 20));
  const zoomOut = () => setZoom((z) => Math.max(50, z - 20));
  const resetZoom = () => setZoom(100);

  // Compression size estimator helper
  const getEstCompression = () => {
    if (!activeFile) return '';
    const size = activeFile.size;
    let factor = 0.7; // recommended
    if (compressLevel === 'extreme') factor = 0.45;
    if (compressLevel === 'less') factor = 0.85;
    const est = Math.round(size * factor);
    return `${formatFileSize(size)} → ~${formatFileSize(est)} (-${Math.round((1 - factor) * 100)}%)`;
  };

  return (
    <div className="bg-card border-2 border-border rounded-3xl p-5 shadow-xl flex flex-col h-full space-y-4 relative overflow-hidden">
      {/* SIDEBAR HEADER */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-foreground font-heading flex items-center gap-1.5">
              Ready Output Preview
            </h3>
            <p className="text-[11px] text-muted-foreground">Live visualization for {toolName}</p>
          </div>
        </div>

        {/* Live Syncing Badge */}
        <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Sync
        </div>
      </div>

      {/* NO FILE PLACEHOLDER */}
      {!activeFile && toolId !== 'html-to-pdf' && (
        <div className="flex-1 min-h-[320px] flex flex-col items-center justify-center p-6 text-center bg-secondary/30 rounded-2xl border-2 border-dashed border-border/70 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-1">
            <FileText className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-bold text-foreground">No Document Loaded</h4>
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
            Select or drag & drop a PDF file to inspect live real-time output preview, page layout, and transformations.
          </p>
        </div>
      )}

      {/* HTML TO PDF PREVIEW MODE — text-only by design, matching the safe PDF extraction path. */}
      {toolId === 'html-to-pdf' && !activeFile && (
        <div className="flex-1 min-h-[340px] bg-white rounded-2xl border border-border p-4 text-slate-800 text-xs overflow-auto shadow-inner space-y-2">
          <div className="text-[10px] font-bold uppercase text-slate-400 border-b pb-1 mb-2">PDF Content Preview</div>
          {htmlPreviewBlocks.length > 0 ? (
            <div className="space-y-3 text-slate-900">
              {htmlPreviewBlocks.map((text, index) => (
                <p key={`${index}-${text.slice(0, 24)}`} className="whitespace-pre-wrap break-words leading-relaxed">
                  {text}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-slate-500">Enter visible HTML text to preview its PDF content.</p>
          )}
        </div>
      )}

      {/* ACTIVE DOCUMENT CANVAS PREVIEW CONTAINER */}
      {activeFile && (
        <div className="flex-1 flex flex-col space-y-3 min-h-0">
          {/* TOOLBAR CONTROLS */}
          <div className="flex items-center justify-between bg-secondary/50 p-2 rounded-xl border border-border text-xs">
            {/* Page Nav */}
            <div className="flex items-center gap-1">
              <button
                onClick={prevPage}
                disabled={currentPage <= 1}
                className="p-1 rounded-lg hover:bg-background text-foreground disabled:opacity-30 transition"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-foreground px-1">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={nextPage}
                disabled={currentPage >= totalPages}
                className="p-1 rounded-lg hover:bg-background text-foreground disabled:opacity-30 transition"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <button onClick={zoomOut} className="p-1 rounded-lg hover:bg-background text-foreground" title="Zoom Out">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-semibold text-muted-foreground text-[11px] w-9 text-center">{zoom}%</span>
              <button onClick={zoomIn} className="p-1 rounded-lg hover:bg-background text-foreground" title="Zoom In">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button onClick={resetZoom} className="p-1 rounded-lg hover:bg-background text-foreground" title="Reset Zoom">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* MAIN CANVAS VIEWPORT WITH LIVE OVERLAYS */}
          <div
            ref={containerRef}
            className="relative flex-1 min-h-[320px] max-h-[480px] bg-secondary/30 rounded-2xl border border-border p-4 flex items-center justify-center overflow-auto shadow-inner"
          >
            {loading && (
              <div className="absolute inset-0 z-20 bg-card/60 backdrop-blur-xs flex flex-col items-center justify-center space-y-2">
                <div className="w-7 h-7 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-foreground">Rendering Preview...</span>
              </div>
            )}

            {error && (
              <div className="p-4 text-center text-xs text-rose-500 space-y-1">
                <p className="font-bold">Preview Error</p>
                <p className="text-[11px] opacity-80">{error}</p>
              </div>
            )}

            {/* CANVAS RENDERER AND TOOL OVERLAYS */}
            <div className="relative inline-block transition-transform duration-300 shadow-lg rounded-lg overflow-hidden border border-border bg-white">
              {/* IMAGE FILE PREVIEW */}
              {activeFile.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(activeFile)}
                  alt="Preview"
                  className="max-h-[380px] object-contain"
                  style={{
                    transform: `rotate(${rotationAngle}deg)`,
                    transition: 'transform 0.3s ease',
                  }}
                />
              ) : (
                /* PDF CANVAS */
                <canvas
                  ref={canvasRef}
                  className="block max-w-full h-auto"
                  style={{
                    transform: toolId === 'rotate' ? `rotate(${rotationAngle}deg)` : 'none',
                    transition: 'transform 0.3s ease',
                  }}
                />
              )}

              {/* OVERLAY 1: WATERMARK PREVIEW OVERLAY */}
              {toolId === 'watermark' && watermarkConfig && watermarkConfig.text && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
                  <span
                    style={{
                      color: watermarkConfig.color,
                      fontSize: `${watermarkConfig.size * (zoom / 100) * 0.7}px`,
                      opacity: watermarkConfig.opacity / 100,
                      transform: `rotate(${watermarkConfig.angle}deg)`,
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                      userSelect: 'none',
                    }}
                  >
                    {watermarkConfig.text}
                  </span>
                </div>
              )}

              {/* OVERLAY 2: PAGE NUMBER PREVIEW OVERLAY */}
              {toolId === 'page-numbers' && pageNumConfig && (
                <div
                  className={`absolute pointer-events-none p-3 text-xs font-bold ${
                    pageNumConfig.position === 'bottom-right'
                      ? 'bottom-2 right-2 text-right'
                      : pageNumConfig.position === 'bottom-center'
                      ? 'bottom-2 left-1/2 -translate-x-1/2 text-center'
                      : pageNumConfig.position === 'bottom-left'
                      ? 'bottom-2 left-2 text-left'
                      : 'top-2 right-2 text-right'
                  }`}
                  style={{ color: pageNumConfig.color }}
                >
                  {pageNumConfig.format === 'page_n_of_m'
                    ? `Page ${currentPage} of ${totalPages}`
                    : `${currentPage}`}
                </div>
              )}

              {/* OVERLAY 3: CROP MARGINS GUIDE OVERLAY */}
              {toolId === 'crop' && cropMargins && (
                <div
                  className="absolute inset-0 pointer-events-none border-2 border-dashed border-rose-500 bg-rose-500/10"
                  style={{
                    top: `${cropMargins.top}px`,
                    right: `${cropMargins.right}px`,
                    bottom: `${cropMargins.bottom}px`,
                    left: `${cropMargins.left}px`,
                  }}
                >
                  <span className="absolute top-1 left-1 bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                    Cropped Boundary Area
                  </span>
                </div>
              )}

              {/* OVERLAY 4: PROTECT PDF BADGE OVERLAY */}
              {toolId === 'protect' && (
                <div className="absolute top-2 right-2 bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-1 rounded-lg shadow-md flex items-center gap-1 uppercase tracking-wider">
                  <Lock className="w-3 h-3" />
                  {password ? 'Encrypted (Password Set)' : 'Enter Password'}
                </div>
              )}

              {/* OVERLAY 5: UNLOCK PDF BADGE OVERLAY */}
              {toolId === 'unlock' && (
                <div className="absolute top-2 right-2 bg-emerald-500 text-white font-black text-[10px] px-2 py-1 rounded-lg shadow-md flex items-center gap-1 uppercase tracking-wider">
                  <Unlock className="w-3 h-3" /> Security Removed
                </div>
              )}
            </div>
          </div>

          {/* TOOL SPECIFIC METADATA / STATS FOOTER */}
          <div className="bg-secondary/40 p-3 rounded-2xl border border-border text-xs space-y-1.5">
            {toolId === 'compress' && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="font-semibold">Est. Compressed Size:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{getEstCompression()}</span>
              </div>
            )}

            {toolId === 'rotate' && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="font-semibold">Applied Page Rotation:</span>
                <span className="font-bold text-primary">{rotationAngle}° Clockwise</span>
              </div>
            )}

            {toolId === 'protect' && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="font-semibold">Protection Standard:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">RC4 128-Bit PDF Encryption</span>
              </div>
            )}

            {toolId === 'merge' && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="font-semibold">Merge Queue:</span>
                <span className="font-bold text-primary">{files.length} Document(s) Combined</span>
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              <span>Ready Document Name:</span>
              <span className="font-bold text-foreground truncate max-w-[180px]">
                {toolId}-{activeFile.name}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
