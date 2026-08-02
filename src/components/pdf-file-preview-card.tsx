'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  FileText, Calendar, HardDrive, Layers, Maximize2, Lock, Unlock,
  Trash2, ArrowUp, ArrowDown, Info, Image as ImageIcon, ChevronDown, ChevronUp, Eye
} from 'lucide-react';
import { FullPdfMetadata, getFullPdfMetadata, renderPageToCanvas } from '@/lib/engines/pdf-renderer-engine';

interface PdfFilePreviewCardProps {
  file: File;
  index: number;
  totalFiles: number;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isMultiFile?: boolean;
}

export function PdfFilePreviewCard({
  file,
  index,
  totalFiles,
  onRemove,
  onMoveUp,
  onMoveDown,
  isMultiFile = false,
}: PdfFilePreviewCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [metadata, setMetadata] = useState<FullPdfMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRenderError(null);

    // If image file
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      getFullPdfMetadata(file).then((meta) => {
        if (!cancelled) {
          setMetadata(meta);
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
        URL.revokeObjectURL(url);
      };
    }

    // PDF file
    getFullPdfMetadata(file)
      .then((meta) => {
        if (cancelled) return;
        setMetadata(meta);

        if (!meta.isEncrypted && canvasRef.current) {
          renderPageToCanvas(file, 1, canvasRef.current, 0.4)
            .then(() => {
              if (!cancelled) setLoading(false);
            })
            .catch((err) => {
              if (!cancelled) {
                setRenderError(err.message || 'Preview unavailable');
                setLoading(false);
              }
            });
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRenderError(err.message || 'Failed to parse metadata');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  return (
    <div className="group relative bg-card border-2 border-border/80 hover:border-primary/60 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* THUMBNAIL CANVAS / IMAGE PREVIEW */}
        <div className="relative w-24 h-32 shrink-0 bg-secondary/60 rounded-xl border border-border flex flex-col items-center justify-center overflow-hidden shadow-inner group/thumb">
          {file.type.startsWith('image/') && imageUrl ? (
            <img src={imageUrl} alt={file.name} className="w-full h-full object-cover" />
          ) : (
            <>
              <canvas ref={canvasRef} className={`w-full h-full object-contain ${loading || metadata?.isEncrypted ? 'hidden' : 'block'}`} />
              {(loading || metadata?.isEncrypted || renderError) && (
                <div className="flex flex-col items-center justify-center p-2 text-center space-y-1">
                  {metadata?.isEncrypted ? (
                    <>
                      <Lock className="w-7 h-7 text-amber-500" />
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Protected</span>
                    </>
                  ) : renderError ? (
                    <>
                      <FileText className="w-7 h-7 text-muted-foreground opacity-50" />
                      <span className="text-[9px] text-muted-foreground">PDF Preview</span>
                    </>
                  ) : (
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
              )}
            </>
          )}

          {/* Page Count overlay badge */}
          {metadata && metadata.pageCount > 0 && !file.type.startsWith('image/') && (
            <div className="absolute bottom-1 right-1 bg-black/75 backdrop-blur-md text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-md shadow-xs">
              {metadata.pageCount} Pgs
            </div>
          )}
        </div>

        {/* METADATA INFO */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {isMultiFile && (
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                )}
                <h4 className="text-sm font-bold text-foreground truncate max-w-xs sm:max-w-md" title={file.name}>
                  {file.name}
                </h4>
              </div>

              {/* PRIMARY METADATA BADGES */}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-secondary/80 text-foreground px-2 py-0.5 rounded-md border border-border">
                  <HardDrive className="w-3 h-3 text-primary" />
                  {metadata?.fileSizeFormatted || `${(file.size / 1024).toFixed(1)} KB`}
                </span>

                {metadata && !file.type.startsWith('image/') && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-secondary/80 text-foreground px-2 py-0.5 rounded-md border border-border">
                    <Layers className="w-3 h-3 text-indigo-500" />
                    {metadata.pageCount} {metadata.pageCount === 1 ? 'Page' : 'Pages'}
                  </span>
                )}

                {metadata && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-secondary/80 text-foreground px-2 py-0.5 rounded-md border border-border">
                    <Maximize2 className="w-3 h-3 text-rose-500" />
                    {metadata.paperFormat} ({metadata.widthIn} × {metadata.heightIn} in)
                  </span>
                )}

                {metadata?.isEncrypted ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/30">
                    <Lock className="w-3 h-3 text-amber-600" /> Password Protected
                  </span>
                ) : metadata ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    <Unlock className="w-3 h-3 text-emerald-500" /> Unlocked
                  </span>
                ) : null}
              </div>
            </div>

            {/* CARD ACTION BUTTONS */}
            <div className="flex items-center gap-1 shrink-0">
              {isMultiFile && onMoveUp && (
                <button
                  onClick={onMoveUp}
                  disabled={index === 0}
                  className="p-1.5 rounded-lg bg-secondary text-foreground hover:bg-primary hover:text-white disabled:opacity-30 transition"
                  title="Move Up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
              )}
              {isMultiFile && onMoveDown && (
                <button
                  onClick={onMoveDown}
                  disabled={index === totalFiles - 1}
                  className="p-1.5 rounded-lg bg-secondary text-foreground hover:bg-primary hover:text-white disabled:opacity-30 transition"
                  title="Move Down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              )}
              {onRemove && (
                <button
                  onClick={onRemove}
                  className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-600 hover:text-white transition"
                  title="Remove File"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* SECONDARY METADATA ROW & DETAILS ACCORDION TOGGLE */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Modified: {metadata?.lastModifiedFormatted || 'Just now'}
            </span>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-primary font-bold hover:underline flex items-center gap-1 text-[11px]"
            >
              <Info className="w-3 h-3" />
              {showDetails ? 'Hide Properties' : 'View PDF Metadata'}
              {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {/* DETAILED PROPERTIES ACCORDION PANEL */}
          {showDetails && metadata && (
            <div className="mt-2 p-3 bg-secondary/50 rounded-xl border border-border text-xs space-y-1.5 text-foreground animate-fadeIn">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">Dimensions</span>
                  <span className="font-semibold">{metadata.widthPt} × {metadata.heightPt} pt ({metadata.widthMm} × {metadata.heightMm} mm)</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">Orientation</span>
                  <span className="font-semibold">{metadata.orientation}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">MIME Type</span>
                  <span className="font-semibold">{metadata.fileType}</span>
                </div>
                {metadata.title && (
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Title</span>
                    <span className="font-semibold truncate block">{metadata.title}</span>
                  </div>
                )}
                {metadata.author && (
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Author</span>
                    <span className="font-semibold truncate block">{metadata.author}</span>
                  </div>
                )}
                {metadata.producer && (
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">PDF Producer</span>
                    <span className="font-semibold truncate block">{metadata.producer}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
