'use client';

import React, { useState } from 'react';
import { TOOL_REGISTRY, ToolDef } from './tool-registry';
import { Plus, Trash2, ArrowRight, Play, Sparkles, CheckCircle, FileUp } from 'lucide-react';
import { executeWorkflow, downloadBytes } from '@/lib/pdf-engine';
import { useToast } from '@/hooks/use-toast';

export function WorkflowBuilder({ onClose }: { onClose?: () => void }) {
  const { toast } = useToast();
  const [selectedTools, setSelectedTools] = useState<ToolDef[]>([
    TOOL_REGISTRY.find((t) => t.id === 'merge')!,
    TOOL_REGISTRY.find((t) => t.id === 'watermark')!,
    TOOL_REGISTRY.find((t) => t.id === 'compress')!,
  ]);
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [watermarkText, setWatermarkText] = useState('LOVE FOR PDF');

  const addStep = (toolId: string) => {
    const tool = TOOL_REGISTRY.find((t) => t.id === toolId);
    if (tool) setSelectedTools([...selectedTools, tool]);
  };

  const removeStep = (index: number) => {
    setSelectedTools(selectedTools.filter((_, i) => i !== index));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const runCustomWorkflow = async () => {
    if (files.length === 0) {
      toast({ title: 'No files selected', description: 'Please upload at least one PDF file to execute workflow.', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    setProgress(10);

    try {
      const steps = selectedTools.map((t) => ({
        toolId: t.id,
        params: t.id === 'watermark' ? { text: watermarkText } : {},
      }));

      const bytes = await executeWorkflow(files, steps, (p: number) => setProgress(p));
      downloadBytes(bytes, `workflow-result-${Date.now()}.pdf`);
      toast({ title: 'Workflow Executed Successfully! ❤️', description: 'Your processed document has been downloaded.' });
    } catch (err: any) {
      toast({ title: 'Workflow Execution Error', description: err.message || 'An error occurred.', variant: 'destructive' });
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white border border-rose-100 rounded-3xl shadow-xl text-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-rose-600 to-pink-500 rounded-2xl text-white shadow-md">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-heading">Custom Workflow Builder</h2>
            <p className="text-sm text-slate-500">Chain tools together & automate PDF tasks in one click</p>
          </div>
        </div>
      </div>

      {/* Steps Visual Pipeline */}
      <div className="mb-8">
        <label className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-3 block">
          Workflow Chain ({selectedTools.length} Steps)
        </label>
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          {selectedTools.map((tool, idx) => (
            <React.Fragment key={idx}>
              <div className="flex items-center gap-2 bg-white border border-rose-200 px-3.5 py-2 rounded-xl text-sm font-medium shadow-xs">
                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 text-xs flex items-center justify-center font-bold">
                  {idx + 1}
                </span>
                {tool.name}
                <button
                  onClick={() => removeStep(idx)}
                  className="text-slate-400 hover:text-rose-600 transition ml-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {idx < selectedTools.length - 1 && (
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Add More Tools to Chain */}
      <div className="mb-8">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
          Add Tool to Step Chain
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {['watermark', 'rotate', 'page-numbers', 'compress', 'pdf-a'].map((id) => {
            const tool = TOOL_REGISTRY.find((t) => t.id === id);
            if (!tool) return null;
            return (
              <button
                key={id}
                onClick={() => addStep(id)}
                className="flex items-center gap-2 p-2.5 bg-slate-50 hover:bg-rose-50/50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium transition"
              >
                <Plus className="w-3.5 h-3.5 text-rose-600" />
                {tool.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Configuration Settings */}
      {selectedTools.some((t) => t.id === 'watermark') && (
        <div className="mb-8 p-4 bg-rose-50/40 rounded-2xl border border-rose-100">
          <label className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-2 block">
            Watermark Step Settings
          </label>
          <input
            type="text"
            value={watermarkText}
            onChange={(e) => setWatermarkText(e.target.value)}
            placeholder="Watermark Text"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-rose-500"
          />
        </div>
      )}

      {/* File Upload & Execute */}
      <div className="space-y-4">
        <div className="relative border-2 border-dashed border-rose-300 bg-rose-50/30 rounded-2xl p-6 text-center hover:border-rose-400 transition cursor-pointer">
          <input
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <FileUp className="w-10 h-10 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-800">
            {files.length > 0
              ? `${files.length} file(s) selected: ${files.map((f) => f.name).join(', ')}`
              : 'Drop PDF file(s) here or click to select'}
          </p>
        </div>

        {processing && (
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
            <div
              className="bg-gradient-to-r from-rose-500 to-pink-500 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <button
          onClick={runCustomWorkflow}
          disabled={processing || files.length === 0}
          className="btn-love w-full py-4 text-base font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2"
        >
          {processing ? (
            'Executing Workflow...'
          ) : (
            <>
              <Play className="w-5 h-5 fill-current" /> Execute Custom Workflow
            </>
          )}
        </button>
      </div>
    </div>
  );
}
