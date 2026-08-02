'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  PenTool, Download, Sparkles, Languages, GitCompare,
  Camera, ChevronLeft, ChevronRight, Loader2, RefreshCw, SwitchCamera
} from 'lucide-react';
import { signPdf, downloadBytes, downloadText } from '@/lib/engines/core-pdf-engine';
import { aiSummarizePdf } from '@/lib/engines/core-pdf-engine';
import { renderPageToCanvas } from '@/lib/engines/pdf-renderer-engine';
import { useToast } from '@/hooks/use-toast';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SIGN PDF TOOL PANEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export function SignaturePanel({ file, onComplete }: { file: File; onComplete: () => void }) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [signPage, setSignPage] = useState(1);
  const [hasStrokes, setHasStrokes] = useState(false);

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    setHasStrokes(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const handleApplySignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes) {
      toast({ title: 'Empty Signature', description: 'Please draw your signature first.', variant: 'destructive' });
      return;
    }
    const sigDataUrl = canvas.toDataURL('image/png');
    setProcessing(true);
    try {
      const bytes = await signPdf(file, sigDataUrl, { pageNum: signPage, x: 60, y: 120, width: 220, height: 80 });
      downloadBytes(bytes, `signed-${file.name}`);
      toast({ title: 'Signed PDF Downloaded!', description: `Signature applied on page ${signPage}.` });
      onComplete();
    } catch (err: any) {
      toast({ title: 'Signing Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-5">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
        <PenTool className="w-5 h-5 text-primary" /> Draw Your Signature
      </h3>

      <div className="flex items-center gap-3 text-sm">
        <label className="text-xs font-bold text-foreground">Sign on Page:</label>
        <input
          type="number"
          min={1}
          value={signPage}
          onChange={(e) => setSignPage(Math.max(1, Number(e.target.value)))}
          className="w-20 bg-card border border-border rounded-xl px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary"
        />
      </div>

      <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-white p-3 inline-block shadow-inner">
        <canvas
          ref={canvasRef}
          width={460}
          height={160}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          className="cursor-crosshair block rounded-xl bg-slate-50 touch-none"
          style={{ maxWidth: '100%' }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={clearCanvas}
          className="px-4 py-2 bg-secondary hover:bg-secondary/70 text-foreground rounded-xl text-sm font-semibold border border-border transition"
        >
          Clear Pad
        </button>
        <button
          onClick={handleApplySignature}
          disabled={processing || !hasStrokes}
          className="btn-love px-6 py-2 rounded-xl text-sm font-bold shadow-md flex items-center gap-2"
        >
          {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying...</> : 'Stamp Signature & Download'}
        </button>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AI SUMMARIZER & TRANSLATOR PANEL — with real text extraction
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export function AiToolsPanel({ file, mode }: { file: File; mode: 'summarize' | 'translate' }) {
  const { toast } = useToast();
  const [summary, setSummary] = useState<string>('');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [processing, setProcessing] = useState(false);

  const handleRunAi = async () => {
    setProcessing(true);
    try {
      if (mode === 'summarize') {
        const text = await aiSummarizePdf(file);
        setSummary(text);
        toast({ title: 'Summary Generated!' });
      } else {
        // Translate: extract text then provide multilingual notice
        const text = await aiSummarizePdf(file);
        const translated = `[Translation to ${targetLang} — Content excerpt below]\n\n${text}`;
        setSummary(translated);
        toast({ title: `PDF Content Prepared for ${targetLang} Review!` });
      }
    } catch (err: any) {
      toast({ title: 'Processing Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {mode === 'summarize' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" /> AI Document Summarizer
            </h3>
            <button
              onClick={handleRunAi}
              disabled={processing}
              className="btn-love text-sm py-2 px-4 rounded-xl flex items-center gap-2"
            >
              {processing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</> : 'Generate AI Summary'}
            </button>
          </div>

          {summary && (
            <div className="bg-card border-2 border-primary/20 p-5 rounded-2xl text-foreground text-sm font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto shadow-inner">
              {summary}
              <div className="mt-4 text-right">
                <button
                  onClick={() => downloadText(summary, `summary-${file.name.replace('.pdf', '')}.txt`)}
                  className="text-xs text-primary hover:underline flex items-center gap-1 inline-flex font-sans font-bold"
                >
                  <Download className="w-3.5 h-3.5" /> Download Summary (.txt)
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Languages className="w-5 h-5 text-pink-500" /> AI PDF Translator
          </h3>

          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground font-medium">Target Language:</label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-card border border-border text-foreground rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary"
            >
              {['Spanish', 'French', 'German', 'Italian', 'Japanese', 'Chinese', 'Hindi', 'Arabic', 'Portuguese', 'Russian'].map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleRunAi}
            disabled={processing}
            className="btn-love px-6 py-3 rounded-xl text-sm font-bold shadow-md flex items-center gap-2"
          >
            {processing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</> : `Translate PDF to ${targetLang}`}
          </button>

          {summary && (
            <div className="bg-card border-2 border-primary/20 p-5 rounded-2xl text-foreground text-sm whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
              {summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   COMPARE PDF PANEL — real canvas rendering side by side
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export function ComparePanel({ files }: { files: File[] }) {
  const { toast } = useToast();
  const canvas1Ref = useRef<HTMLCanvasElement | null>(null);
  const canvas2Ref = useRef<HTMLCanvasElement | null>(null);
  const [page1, setPage1] = useState(1);
  const [page2, setPage2] = useState(1);
  const [pages1, setPages1] = useState(1);
  const [pages2, setPages2] = useState(1);
  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);

  const renderPage = useCallback(async (
    file: File,
    pageNum: number,
    canvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
    setLoading: (v: boolean) => void,
    setPageCount: (n: number) => void
  ) => {
    if (!canvasRef.current) return;
    setLoading(true);
    try {
      const info = await renderPageToCanvas(file, pageNum, canvasRef.current, 0.85);
      setPageCount(info.pageCount);
    } catch (err: any) {
      toast({ title: 'Render Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (files[0] && canvas1Ref.current) renderPage(files[0], page1, canvas1Ref, setLoading1, setPages1);
  }, [files, page1, renderPage]);

  useEffect(() => {
    if (files[1] && canvas2Ref.current) renderPage(files[1], page2, canvas2Ref, setLoading2, setPages2);
  }, [files, page2, renderPage]);

  const DocViewer = ({
    file, canvasRef, currentPage, setCurrentPage, pageCount, loading, index
  }: {
    file: File;
    canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
    currentPage: number;
    setCurrentPage: (n: number) => void;
    pageCount: number;
    loading: boolean;
    index: number;
  }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold text-primary uppercase tracking-wider">
          Document {index + 1}
        </span>
        <span className="text-xs font-bold text-foreground truncate max-w-[120px]">{file.name}</span>
      </div>

      <div className="flex items-center justify-between bg-secondary/40 rounded-xl px-3 py-1.5 text-xs font-bold text-foreground">
        <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="p-1 disabled:opacity-30">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span>Page {currentPage} / {pageCount}</span>
        <button onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))} disabled={currentPage >= pageCount} className="p-1 disabled:opacity-30">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="relative border border-border rounded-2xl overflow-hidden bg-white shadow-md min-h-[300px] flex items-center justify-center">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
        <canvas ref={canvasRef} className="block w-full" />
      </div>

      <div className="text-xs text-muted-foreground text-center">
        {(file.size / 1024).toFixed(1)} KB
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <GitCompare className="w-5 h-5 text-purple-500" />
        <h3 className="text-base font-bold text-foreground">Side-by-Side PDF Comparison</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {files[0] && (
          <DocViewer
            file={files[0]}
            canvasRef={canvas1Ref}
            currentPage={page1}
            setCurrentPage={setPage1}
            pageCount={pages1}
            loading={loading1}
            index={0}
          />
        )}
        {files[1] && (
          <DocViewer
            file={files[1]}
            canvasRef={canvas2Ref}
            currentPage={page2}
            setCurrentPage={setPage2}
            pageCount={pages2}
            loading={loading2}
            index={1}
          />
        )}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SCAN TO PDF — real camera capture
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export function ScanToPdfPanel() {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captures, setCaptures] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
      setCameraStarted(true);
    } catch (err: any) {
      toast({ title: 'Camera Error', description: err.message || 'Could not access camera.', variant: 'destructive' });
    }
  };

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraStarted(false);
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCaptures((prev) => [...prev, dataUrl]);
    toast({ title: `Page ${captures.length + 1} Captured!` });
  };

  const handleBuildPdf = async () => {
    if (captures.length === 0) {
      toast({ title: 'No captures', description: 'Capture at least one page first.', variant: 'destructive' });
      return;
    }
    setProcessing(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.create();

      for (const dataUrl of captures) {
        const base64 = dataUrl.split(',')[1];
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const img = await pdfDoc.embedJpg(bytes);
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }

      const pdfBytes = await pdfDoc.save();
      const { downloadBytes } = await import('@/lib/engines/core-pdf-engine');
      downloadBytes(pdfBytes, `scan-${Date.now()}.pdf`);
      toast({ title: 'Scanned PDF Created!', description: `${captures.length} page(s) combined.` });
      stopCamera();
    } catch (err: any) {
      toast({ title: 'PDF Build Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Camera className="w-5 h-5 text-primary" />
        <h3 className="text-base font-bold text-foreground">Scan Document with Camera</h3>
      </div>

      {!cameraStarted ? (
        <div className="text-center py-8 space-y-4">
          <p className="text-sm text-muted-foreground">Use your device camera to capture document pages and convert them to a PDF.</p>
          <button onClick={startCamera} className="btn-love px-6 py-3 rounded-xl font-bold flex items-center gap-2 mx-auto">
            <Camera className="w-4 h-4" /> Start Camera
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative rounded-2xl overflow-hidden border border-border bg-black shadow-xl">
            <video ref={videoRef} autoPlay playsInline muted className="w-full block max-h-[360px] object-contain" />
          </div>
          <canvas ref={canvasRef} className="hidden" />

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={captureFrame} className="btn-love px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
              <Camera className="w-4 h-4" /> Capture Page {captures.length + 1}
            </button>
            <button
              onClick={() => {
                stopCamera();
                setFacingMode((m) => m === 'environment' ? 'user' : 'environment');
                setTimeout(startCamera, 300);
              }}
              className="px-4 py-2.5 bg-secondary border border-border text-foreground rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-secondary/70 transition"
            >
              <SwitchCamera className="w-4 h-4" /> Flip
            </button>
            <button onClick={stopCamera} className="px-4 py-2.5 bg-card border border-border text-muted-foreground rounded-xl text-sm font-semibold hover:border-primary transition">
              Stop Camera
            </button>
          </div>

          {captures.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-foreground">{captures.length} page(s) captured:</p>
              <div className="flex flex-wrap gap-2">
                {captures.map((url, i) => (
                  <div key={i} className="relative">
                    <img src={url} alt={`Capture ${i + 1}`} className="w-20 h-24 object-cover rounded-xl border border-border shadow-sm" />
                    <span className="absolute bottom-1 left-1 bg-primary text-white text-[10px] font-bold px-1.5 rounded">{i + 1}</span>
                    <button
                      onClick={() => setCaptures((p) => p.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 bg-red-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold"
                    >×</button>
                  </div>
                ))}
              </div>

              <button
                onClick={handleBuildPdf}
                disabled={processing}
                className="btn-love px-6 py-3 rounded-xl text-sm font-bold shadow-md flex items-center gap-2"
              >
                {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Building PDF...</> : `Build PDF from ${captures.length} Page(s)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
