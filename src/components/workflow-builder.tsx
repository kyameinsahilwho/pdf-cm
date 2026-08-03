'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  ArrowRight,
  Play,
  FileUp,
  ChevronUp,
  ChevronDown,
  Lock,
  Layers,
  FileText,
  RotateCw,
  Hash,
  Minimize2,
  ShieldCheck,
  Wrench,
  CheckCircle2,
  Wand2,
  Copy,
  Info
} from 'lucide-react';
import { executeWorkflow, downloadBytes } from '@/lib/engines/core-pdf-engine';
import { useToast } from '@/hooks/use-toast';

export interface WorkflowStep {
  id: string;
  toolId: string;
  name: string;
  iconName: string;
  gradient: string;
  params: Record<string, any>;
}

// Available tools in the workflow builder
const AVAILABLE_TOOLS = [
  {
    toolId: 'watermark',
    name: 'Add Watermark',
    desc: 'Stamp custom text or confidential mark across pages',
    iconName: 'Stamp',
    gradient: 'from-rose-500 to-pink-600',
    defaultParams: { text: 'CONFIDENTIAL', opacity: 0.3 }
  },
  {
    toolId: 'rotate',
    name: 'Rotate Pages',
    desc: 'Rotate all pages by 90°, 180°, or 270°',
    iconName: 'RotateCw',
    gradient: 'from-purple-500 to-indigo-600',
    defaultParams: { degrees: 90 }
  },
  {
    toolId: 'page-numbers',
    name: 'Add Page Numbers',
    desc: 'Insert sequential page numbers into header or footer',
    iconName: 'Hash',
    gradient: 'from-blue-500 to-cyan-600',
    defaultParams: { format: 'Page {page} of {total}', position: 'bottom-center' }
  },
  {
    toolId: 'compress',
    name: 'Compress PDF',
    desc: 'Reduce file size while preserving layout quality',
    iconName: 'Minimize2',
    gradient: 'from-emerald-500 to-teal-600',
    defaultParams: { level: 'medium' }
  },
  {
    toolId: 'protect',
    name: 'Encrypt & Protect',
    desc: 'Password-protect PDF with strong encryption',
    iconName: 'Lock',
    gradient: 'from-amber-500 to-orange-600',
    defaultParams: { password: '' }
  },
  {
    toolId: 'pdf-a',
    name: 'Convert to PDF/A',
    desc: 'Standardize PDF for long-term ISO archival storage',
    iconName: 'ShieldCheck',
    gradient: 'from-slate-700 to-slate-900',
    defaultParams: {}
  },
  {
    toolId: 'repair',
    name: 'Repair PDF',
    desc: 'Fix structural errors & corrupt PDF objects',
    iconName: 'Wrench',
    gradient: 'from-sky-600 to-indigo-700',
    defaultParams: {}
  }
];

// Presets for quick 1-click workflows
const WORKFLOW_PRESETS = [
  {
    name: '🔒 Confidential & Protected',
    desc: 'Watermark as Confidential, compress, and password protect',
    steps: [
      { toolId: 'watermark', name: 'Add Watermark', params: { text: 'CONFIDENTIAL' } },
      { toolId: 'compress', name: 'Compress PDF', params: { level: 'medium' } },
      { toolId: 'protect', name: 'Encrypt & Protect', params: { password: 'Pass1234!' } }
    ]
  },
  {
    name: '📑 Document Prep & Archival',
    desc: 'Add page numbers, compress, and convert to ISO PDF/A',
    steps: [
      { toolId: 'page-numbers', name: 'Add Page Numbers', params: { format: 'Page {page}' } },
      { toolId: 'compress', name: 'Compress PDF', params: { level: 'medium' } },
      { toolId: 'pdf-a', name: 'Convert to PDF/A', params: {} }
    ]
  },
  {
    name: '⚡ Quick Clean & Rotate',
    desc: 'Rotate pages 90° clockwise and repair PDF formatting',
    steps: [
      { toolId: 'rotate', name: 'Rotate Pages', params: { degrees: 90 } },
      { toolId: 'repair', name: 'Repair PDF', params: {} }
    ]
  }
];

export function WorkflowBuilder({ onClose }: { onClose?: () => void }) {
  const { toast } = useToast();

  const [steps, setSteps] = useState<WorkflowStep[]>([
    {
      id: 'step_1',
      toolId: 'watermark',
      name: 'Add Watermark',
      iconName: 'Stamp',
      gradient: 'from-rose-500 to-pink-600',
      params: { text: 'CONFIDENTIAL' }
    },
    {
      id: 'step_2',
      toolId: 'compress',
      name: 'Compress PDF',
      iconName: 'Minimize2',
      gradient: 'from-emerald-500 to-teal-600',
      params: { level: 'medium' }
    }
  ]);

  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStepName, setCurrentStepName] = useState('');

  // Add step to chain
  const addStep = (toolId: string) => {
    const tool = AVAILABLE_TOOLS.find((t) => t.toolId === toolId);
    if (!tool) return;

    const newStep: WorkflowStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      toolId: tool.toolId,
      name: tool.name,
      iconName: tool.iconName,
      gradient: tool.gradient,
      params: { ...tool.defaultParams }
    };

    setSteps([...steps, newStep]);
  };

  // Remove step
  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  // Move step up or down
  const moveStep = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;

    const updated = [...steps];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIdx, 0, moved);
    setSteps(updated);
  };

  // Update step parameter
  const updateStepParam = (stepId: string, paramKey: string, value: any) => {
    setSteps(
      steps.map((s) => (s.id === stepId ? { ...s, params: { ...s.params, [paramKey]: value } } : s))
    );
  };

  // Load preset template
  const loadPreset = (preset: typeof WORKFLOW_PRESETS[0]) => {
    const loadedSteps: WorkflowStep[] = preset.steps.map((s, idx) => {
      const tool = AVAILABLE_TOOLS.find((t) => t.toolId === s.toolId)!;
      return {
        id: `preset_${idx}_${Date.now()}`,
        toolId: s.toolId,
        name: s.name,
        iconName: tool?.iconName || 'Wrench',
        gradient: tool?.gradient || 'from-rose-500 to-pink-600',
        params: { ...s.params }
      };
    });
    setSteps(loadedSteps);
    toast({ title: 'Preset Loaded', description: `Loaded "${preset.name}" preset workflow.` });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const runWorkflow = async () => {
    if (files.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please upload at least one PDF file to run the workflow.',
        variant: 'destructive'
      });
      return;
    }

    if (steps.length === 0) {
      toast({
        title: 'No workflow steps',
        description: 'Please add at least one processing step to the workflow.',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);
    setProgress(5);

    try {
      const workflowSteps = steps.map((s) => ({
        toolId: s.toolId,
        params: s.params
      }));

      const bytes = await executeWorkflow(files, workflowSteps, (p: number) => {
        setProgress(p);
        const currentIdx = Math.min(Math.floor((p / 100) * steps.length), steps.length - 1);
        if (steps[currentIdx]) {
          setCurrentStepName(`Step ${currentIdx + 1}: ${steps[currentIdx].name}`);
        }
      });

      downloadBytes(bytes, `workflow-automation-${Date.now()}.pdf`);
      toast({
        title: 'Workflow Completed Successfully! 🎉',
        description: `Executed ${steps.length} automated steps across ${files.length} document(s).`
      });
    } catch (err: any) {
      toast({
        title: 'Workflow Execution Error',
        description: err.message || 'An error occurred during workflow execution.',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
      setProgress(0);
      setCurrentStepName('');
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 sm:p-8 bg-white border border-slate-200/80 rounded-3xl shadow-2xl text-slate-900 font-sans">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-6 mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-tr from-rose-600 to-pink-500 rounded-2xl text-white shadow-lg shadow-rose-500/20">
            <Wand2 className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Visual Workflow Automation Builder
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Chain multiple PDF tools together, configure steps, and execute automated pipelines in 1 click
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="self-start sm:self-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
          >
            Close
          </button>
        )}
      </div>

      {/* Preset Workflow Templates */}
      <div className="mb-8">
        <label className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Quick Workflow Presets
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {WORKFLOW_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => loadPreset(preset)}
              className="text-left p-4 bg-slate-50 hover:bg-rose-50/60 border border-slate-200 hover:border-rose-300 rounded-2xl transition group shadow-xs"
            >
              <h4 className="text-sm font-bold text-slate-800 group-hover:text-rose-600 flex items-center justify-between">
                {preset.name}
              </h4>
              <p className="text-xs text-slate-500 mt-1">{preset.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Active Pipeline Canvas */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-rose-600" /> Active Automation Pipeline ({steps.length} Steps)
          </label>
          {steps.length > 0 && (
            <button
              onClick={() => setSteps([])}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold transition"
            >
              Clear All Steps
            </button>
          )}
        </div>

        {steps.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
            <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-slate-600">No steps in workflow pipeline yet</p>
            <p className="text-xs text-slate-400 mt-1">Select a tool from the library below to add your first step</p>
          </div>
        ) : (
          <div className="space-y-3">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                className="bg-white border border-slate-200 hover:border-rose-300 rounded-2xl p-4 shadow-sm transition"
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-rose-100 text-rose-600 text-xs font-black flex items-center justify-center shadow-xs">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        {step.name}
                      </h4>
                      <span className="text-[11px] text-slate-400 font-medium">Tool ID: {step.toolId}</span>
                    </div>
                  </div>

                  {/* Reorder & Action Controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => moveStep(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded-lg text-slate-600 transition"
                      title="Move Step Up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveStep(idx, 'down')}
                      disabled={idx === steps.length - 1}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded-lg text-slate-600 transition"
                      title="Move Step Down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeStep(idx)}
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition ml-2"
                      title="Remove Step"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Inline Parameter Customizer */}
                {step.toolId === 'watermark' && (
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Watermark Text</label>
                      <input
                        type="text"
                        value={step.params.text || ''}
                        onChange={(e) => updateStepParam(step.id, 'text', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-rose-500"
                        placeholder="e.g. CONFIDENTIAL"
                      />
                    </div>
                  </div>
                )}

                {step.toolId === 'rotate' && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3">
                    <label className="text-[11px] font-semibold text-slate-500">Rotation Degrees:</label>
                    <select
                      value={step.params.degrees || 90}
                      onChange={(e) => updateStepParam(step.id, 'degrees', Number(e.target.value))}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 text-xs text-slate-800 focus:outline-none"
                    >
                      <option value={90}>90° Clockwise</option>
                      <option value={180}>180° Flip</option>
                      <option value={270}>270° Counter-Clockwise</option>
                    </select>
                  </div>
                )}

                {step.toolId === 'protect' && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">Encryption Password</label>
                    <input
                      type="password"
                      value={step.params.password || ''}
                      onChange={(e) => updateStepParam(step.id, 'password', e.target.value)}
                      className="w-full sm:w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-rose-500"
                      placeholder="Set PDF Password"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Step Tool Library */}
      <div className="mb-8">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 block">
          Add Tools to Workflow Chain
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {AVAILABLE_TOOLS.map((tool) => (
            <button
              key={tool.toolId}
              onClick={() => addStep(tool.toolId)}
              className="flex items-start gap-2.5 p-3 bg-slate-50 hover:bg-rose-50/60 border border-slate-200 hover:border-rose-300 rounded-2xl transition text-left group shadow-2xs"
            >
              <div className="p-1.5 bg-white border border-slate-200 rounded-xl text-rose-600 group-hover:scale-105 transition">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-800 group-hover:text-rose-600">{tool.name}</h5>
                <p className="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-1">{tool.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Upload File & Execution Controls */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <div className="relative border-2 border-dashed border-rose-300 bg-rose-50/30 hover:bg-rose-50/60 rounded-2xl p-6 text-center transition cursor-pointer">
          <input
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <FileUp className="w-10 h-10 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-800">
            {files.length > 0
              ? `Selected ${files.length} file(s): ${files.map((f) => f.name).join(', ')}`
              : 'Drop target PDF file(s) here or click to select'}
          </p>
          <p className="text-xs text-slate-400 mt-1">Multi-files will be automatically merged into the workflow pipeline</p>
        </div>

        {processing && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-700">
              <span>{currentStepName || 'Processing workflow...'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
              <div
                className="bg-gradient-to-r from-rose-500 via-pink-500 to-purple-600 h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={runWorkflow}
          disabled={processing || files.length === 0 || steps.length === 0}
          className="w-full py-4 text-base font-extrabold text-white bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 rounded-2xl shadow-xl shadow-rose-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? (
            'Executing Workflow Chain...'
          ) : (
            <>
              <Play className="w-5 h-5 fill-current" /> Execute Automation Workflow ({steps.length} Steps)
            </>
          )}
        </button>
      </div>
    </div>
  );
}
