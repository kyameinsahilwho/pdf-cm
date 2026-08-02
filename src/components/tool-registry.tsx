'use client';

import React from 'react';
import {
  Merge, Scissors, Minimize2, FileText, Presentation, FileSpreadsheet,
  FileUp, Edit3, Image, FilePlus, PenTool, Stamp, RotateCw, Globe,
  Unlock, Lock, Layers, Archive, Wrench, Hash, Camera, Search,
  GitCompare, EyeOff, Crop, CheckSquare, Sparkles, Languages,
  FileCode, Workflow, Grid, Copy
} from 'lucide-react';
import { TOOL_REGISTRY as RAW_TOOLS, CATEGORIES, CategoryId, ToolDef as RawToolDef } from '@/lib/tools-data';

export type { CategoryId };
export { CATEGORIES };

export interface ToolDef extends RawToolDef {
  icon: React.ReactNode;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Merge: <Merge className="w-7 h-7 text-white" />,
  Scissors: <Scissors className="w-7 h-7 text-white" />,
  Minimize2: <Minimize2 className="w-7 h-7 text-white" />,
  FileText: <FileText className="w-7 h-7 text-white" />,
  Presentation: <Presentation className="w-7 h-7 text-white" />,
  FileSpreadsheet: <FileSpreadsheet className="w-7 h-7 text-white" />,
  FileUp: <FileUp className="w-7 h-7 text-white" />,
  Edit3: <Edit3 className="w-7 h-7 text-white" />,
  Image: <Image className="w-7 h-7 text-white" />,
  FilePlus: <FilePlus className="w-7 h-7 text-white" />,
  PenTool: <PenTool className="w-7 h-7 text-white" />,
  Stamp: <Stamp className="w-7 h-7 text-white" />,
  RotateCw: <RotateCw className="w-7 h-7 text-white" />,
  Globe: <Globe className="w-7 h-7 text-white" />,
  Unlock: <Unlock className="w-7 h-7 text-white" />,
  Lock: <Lock className="w-7 h-7 text-white" />,
  Layers: <Layers className="w-7 h-7 text-white" />,
  Archive: <Archive className="w-7 h-7 text-white" />,
  Wrench: <Wrench className="w-7 h-7 text-white" />,
  Hash: <Hash className="w-7 h-7 text-white" />,
  Camera: <Camera className="w-7 h-7 text-white" />,
  Search: <Search className="w-7 h-7 text-white" />,
  GitCompare: <GitCompare className="w-7 h-7 text-white" />,
  EyeOff: <EyeOff className="w-7 h-7 text-white" />,
  Crop: <Crop className="w-7 h-7 text-white" />,
  CheckSquare: <CheckSquare className="w-7 h-7 text-white" />,
  Sparkles: <Sparkles className="w-7 h-7 text-white" />,
  Languages: <Languages className="w-7 h-7 text-white" />,
  FileCode: <FileCode className="w-7 h-7 text-white" />,
  Workflow: <Workflow className="w-7 h-7 text-white animate-pulse" />,
  Grid: <Grid className="w-7 h-7 text-white" />,
  Copy: <Copy className="w-7 h-7 text-white" />,
};

export const TOOL_REGISTRY: ToolDef[] = RAW_TOOLS.map((t) => ({
  ...t,
  icon: ICON_MAP[t.iconName] || <FileText className="w-7 h-7 text-white" />,
}));
