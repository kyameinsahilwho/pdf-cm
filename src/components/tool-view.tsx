'use client';

import { ArrowLeft, Upload } from 'lucide-react';
import { useRef, type DragEvent, useState } from 'react';
import { Progress } from '@/components/ui/progress';

interface ToolViewProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  onBack: () => void;
  children: React.ReactNode;
}

export function ToolView({ title, description, icon, color, onBack, children }: ToolViewProps) {
  return (
    <div className="animate-fade-in w-full max-w-2xl mx-auto">
      <button onClick={onBack} className="btn-back mb-6">
        <ArrowLeft className="w-4 h-4" /> All Tools
      </button>
      <div className="tool-card p-0 overflow-hidden cursor-default hover:transform-none hover:shadow-[4px_4px_0px_hsl(var(--border))]">
        <div className="p-6 sm:p-8 border-b border-border">
          <div className="flex items-center gap-4">
            <div className={`tool-icon shrink-0 animate-pop ${color}`}>{icon}</div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">{title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
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
}

export function DropZone({ onFiles, multiple = false, label = 'Drop PDF here or click to browse' }: DropZoneProps) {
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
        accept="application/pdf"
        multiple={multiple}
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) { onFiles(e.target.files); e.target.value = ''; }}}
      />
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Upload className="w-5 h-5 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
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
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {files.length} file{files.length > 1 ? 's' : ''} selected
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
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">{i + 1}</span>
            </div>
            <span className="text-sm truncate flex-1">{f.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(f.id); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
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
    <button onClick={onClick} disabled={disabled || processing} className="btn-fun w-full flex items-center justify-center gap-2">
      {processing ? (
        <>
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {processingLabel || 'Processing...'}
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
