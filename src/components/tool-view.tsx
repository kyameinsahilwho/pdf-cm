'use client';

import { ArrowLeft, Upload } from 'lucide-react';
import { useRef, type DragEvent, useState } from 'react';

interface ToolViewProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
  gradient: string;
  bg: string;
  onBack: () => void;
  children: React.ReactNode;
}

export function ToolView({ title, description, icon, colorClass, bg, onBack, children }: ToolViewProps) {
  return (
    <div className="animate-fade-up w-full max-w-2xl mx-auto">
      <button onClick={onBack} className="btn-back mb-6">
        <ArrowLeft className="w-4 h-4" /> All Tools
      </button>

      <div className="tool-card p-0 overflow-hidden cursor-default hover:transform-none"
           style={{ boxShadow: '0 2px 0 hsl(220 20% 70%), 0 8px 32px hsl(220 20% 50% / 0.14)' }}>
        {/* Tool Header */}
        <div className="p-6 sm:p-8 border-b border-border/70 flex items-center gap-4 relative overflow-hidden">
          {/* Subtle colour wash in header */}
          <div className={`absolute inset-0 opacity-[0.04] bg-gradient-to-r ${bg.replace('bg-', 'from-')} to-transparent`} />
          <div className={`tool-icon ${bg} text-white relative z-10`}>{icon}</div>
          <div className="relative z-10">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">{children}</div>
      </div>
    </div>
  );
}

interface DropZoneProps {
  onFiles: (files: FileList) => void;
  multiple?: boolean;
  label?: string;
  accept?: string;
}

export function DropZone({
  onFiles,
  multiple = false,
  label = 'Drop PDF here or click to browse',
  accept = 'application/pdf'
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={`drop-zone p-8 sm:p-12 text-center ${isDragOver ? 'drag-active' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragEnter={() => setIsDragOver(true)}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) { onFiles(e.target.files); e.target.value = ''; }}}
      />
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
          <Upload className="w-6 h-6 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
        </div>
      </div>
    </div>
  );
}

interface FileListDisplayProps {
  files: { id: string; name: string }[];
  onRemove: (id: string) => void;
  draggable?: boolean;
  onReorder?: (files: any[]) => void;
}

export function FileListDisplay({ files, onRemove, draggable, onReorder }: FileListDisplayProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDrop = (e: DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || !onReorder) return;
    const arr = [...files];
    const item = arr.splice(dragIdx, 1)[0];
    arr.splice(idx, 0, item);
    onReorder(arr);
    setDragIdx(null);
    setOverIdx(null);
  };

  if (!files.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {files.length} file{files.length > 1 ? 's' : ''} selected
        {draggable && <span className="ml-2 opacity-60 font-normal normal-case">· drag to reorder</span>}
      </p>
      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
        {files.map((f, i) => (
          <div
            key={f.id}
            draggable={draggable}
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
            onDragLeave={() => setOverIdx(null)}
            onDrop={(e) => handleDrop(e, i)}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
            className={`file-item ${dragIdx === i ? 'dragging' : ''} ${overIdx === i ? 'drag-over' : ''}`}
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">{i + 1}</span>
            </div>
            <span className="text-sm font-medium truncate flex-1">{f.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(f.id); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ActionButtonProps {
  onClick: () => void;
  disabled?: boolean;
  processing?: boolean;
  label: string;
  processingLabel?: string;
  icon?: React.ReactNode;
}

export function ActionButton({ onClick, disabled, processing, label, processingLabel, icon }: ActionButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled || processing} className="btn-fun w-full flex items-center justify-center gap-2.5 text-base">
      {processing ? (
        <>
          <svg className="animate-spin-slow h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {processingLabel || 'Processing…'}
        </>
      ) : (
        <>
          {icon}
          {label}
        </>
      )}
    </button>
  );
}

export function ProgressBar({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="progress-fancy">
        <div style={{ width: `${value}%` }} />
      </div>
      <p className="text-xs text-muted-foreground text-right">{Math.round(value)}%</p>
    </div>
  );
}
