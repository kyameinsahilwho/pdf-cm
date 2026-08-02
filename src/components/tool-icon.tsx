'use client';

import React from 'react';
import {
  Merge, Scissors, Minimize2, FileText, Presentation, FileSpreadsheet,
  FileUp, Edit3, Image, FilePlus, PenTool, Stamp, RotateCw, Globe,
  Unlock, Lock, Layers, Archive, Wrench, Hash, Camera, Search,
  GitCompare, EyeOff, Crop, CheckSquare, Sparkles, Languages,
  FileCode, Workflow, Grid, Copy
} from 'lucide-react';

const ICON_COMPONENTS: Record<string, React.ElementType> = {
  Merge, Scissors, Minimize2, FileText, Presentation, FileSpreadsheet,
  FileUp, Edit3, Image, FilePlus, PenTool, Stamp, RotateCw, Globe,
  Unlock, Lock, Layers, Archive, Wrench, Hash, Camera, Search,
  GitCompare, EyeOff, Crop, CheckSquare, Sparkles, Languages,
  FileCode, Workflow, Grid, Copy
};

export function getToolGradient(id: string): string {
  switch (id) {
    case 'merge': return 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
    case 'split': return 'linear-gradient(135deg, #a855f7 0%, #4f46e5 100%)';
    case 'compress': return 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)';
    case 'pdf-to-word': return 'linear-gradient(135deg, #2563eb 0%, #0891b2 100%)';
    case 'pdf-to-ppt': return 'linear-gradient(135deg, #f97316 0%, #d97706 100%)';
    case 'pdf-to-excel': return 'linear-gradient(135deg, #16a34a 0%, #059669 100%)';
    case 'word-to-pdf': return 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)';
    case 'ppt-to-pdf': return 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)';
    case 'excel-to-pdf': return 'linear-gradient(135deg, #059669 0%, #15803d 100%)';
    case 'edit': return 'linear-gradient(135deg, #f43f5e 0%, #db2777 100%)';
    case 'pdf-to-jpg': return 'linear-gradient(135deg, #ec4899 0%, #e11d48 100%)';
    case 'jpg-to-pdf': return 'linear-gradient(135deg, #6366f1 0%, #9333ea 100%)';
    case 'sign': return 'linear-gradient(135deg, #14b8a6 0%, #059669 100%)';
    case 'watermark': return 'linear-gradient(135deg, #d946ef 0%, #e11d48 100%)';
    case 'rotate': return 'linear-gradient(135deg, #06b6d4 0%, #0d9488 100%)';
    case 'html-to-pdf': return 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';
    case 'unlock': return 'linear-gradient(135deg, #f59e0b 0%, #eab308 100%)';
    case 'protect': return 'linear-gradient(135deg, #ef4444 0%, #be123c 100%)';
    case 'organize': return 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)';
    case 'pdf-a': return 'linear-gradient(135deg, #475569 0%, #334155 100%)';
    case 'repair': return 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)';
    case 'page-numbers': return 'linear-gradient(135deg, #0891b2 0%, #0d9488 100%)';
    case 'scan-to-pdf': return 'linear-gradient(135deg, #84cc16 0%, #16a34a 100%)';
    case 'ocr': return 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)';
    case 'compare': return 'linear-gradient(135deg, #9333ea 0%, #db2777 100%)';
    case 'redact': return 'linear-gradient(135deg, #e11d48 0%, #991b1b 100%)';
    case 'crop': return 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)';
    case 'pdf-forms': return 'linear-gradient(135deg, #db2777 0%, #e11d48 100%)';
    case 'ai-summarizer': return 'linear-gradient(135deg, #9333ea 0%, #4f46e5 100%)';
    case 'translate': return 'linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)';
    case 'pdf-to-markdown': return 'linear-gradient(135deg, #059669 0%, #0d9488 100%)';
    case 'workflow': return 'linear-gradient(135deg, #f43f5e 0%, #c084fc 50%, #f59e0b 100%)';
    default: return 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)';
  }
}

export function ToolIcon({ iconName, className = "w-7 h-7 text-white" }: { iconName: string; className?: string }) {
  const IconComponent = ICON_COMPONENTS[iconName] || FileText;
  return <IconComponent className={className} />;
}
