'use client';

import { getDocumentProxy } from 'unpdf';

/**
 * Convert PDF to structured Word (.docx) using Python pdf2docx layout engine.
 * STRICT: 100% Python engine required.
 */
export async function pdfToWord(
  file: File | ArrayBuffer,
  onProgress?: (p: number) => void
): Promise<Blob> {
  if (onProgress) onProgress(20);
  
  const formData = new FormData();
  if (file instanceof File) {
    formData.append('file', file);
  } else {
    formData.append('file', new Blob([file], { type: 'application/pdf' }), 'document.pdf');
  }

  const res = await fetch('/api/pdf-to-word', { method: 'POST', body: formData });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.details || `PDF to Word conversion failed with status ${res.status}`);
  }

  if (onProgress) onProgress(100);
  const blob = await res.blob();
  return new Blob([await blob.arrayBuffer()], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/**
 * Convert PDF to Excel XLSX spreadsheet using Python pdfplumber + openpyxl engine.
 * STRICT: 100% Python engine required.
 */
export async function pdfToExcel(
  file: File | ArrayBuffer,
  onProgress?: (p: number) => void
): Promise<Blob> {
  if (onProgress) onProgress(20);

  const formData = new FormData();
  if (file instanceof File) {
    formData.append('file', file);
  } else {
    formData.append('file', new Blob([file], { type: 'application/pdf' }), 'document.pdf');
  }

  const res = await fetch('/api/pdf-to-excel', { method: 'POST', body: formData });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.details || `PDF to Excel conversion failed with status ${res.status}`);
  }

  if (onProgress) onProgress(100);
  const blob = await res.blob();
  return new Blob([await blob.arrayBuffer()], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Convert PDF to PowerPoint PPTX presentation slides using Python python-pptx engine.
 * STRICT: 100% Python engine required.
 */
export async function pdfToPowerPoint(
  file: File | ArrayBuffer,
  onProgress?: (p: number) => void
): Promise<Blob> {
  if (onProgress) onProgress(20);

  const formData = new FormData();
  if (file instanceof File) {
    formData.append('file', file);
  } else {
    formData.append('file', new Blob([file], { type: 'application/pdf' }), 'document.pdf');
  }

  const res = await fetch('/api/pdf-to-ppt', { method: 'POST', body: formData });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.details || `PDF to PowerPoint conversion failed with status ${res.status}`);
  }

  if (onProgress) onProgress(100);
  const blob = await res.blob();
  return new Blob([await blob.arrayBuffer()], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}

/**
 * Convert Office (DOCX/XLSX/PPTX) to PDF using Python high-fidelity conversion engines.
 * STRICT: 100% Python engine required.
 */
export async function officeToPdf(
  file: File,
  type: 'word' | 'ppt' | 'excel',
  onProgress?: (p: number) => void
): Promise<Uint8Array> {
  if (onProgress) onProgress(10);

  const endpoint = type === 'word' ? '/api/word-to-pdf' : type === 'ppt' ? '/api/ppt-to-pdf' : '/api/excel-to-pdf';

  if (onProgress) onProgress(30);
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.details || `${type.toUpperCase()} to PDF conversion failed with status ${res.status}`);
  }

  if (onProgress) onProgress(90);
  const arrayBuf = await res.arrayBuffer();
  if (onProgress) onProgress(100);
  return new Uint8Array(arrayBuf);
}

/**
 * Convert PDF to JPG Images using PDF rendering engine.
 */
export async function pdfToJpgImages(
  file: File | ArrayBuffer,
  scale: number = 1.5,
  onProgress?: (p: number) => void
): Promise<Array<{ pageNum: number; dataUrl: string }>> {
  if (onProgress) onProgress(10);
  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const results: Array<{ pageNum: number; dataUrl: string }> = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      results.push({ pageNum: i, dataUrl: canvas.toDataURL('image/jpeg', 0.92) });
    }
    if (onProgress) onProgress(Math.floor(10 + (i / pdf.numPages) * 90));
  }

  return results;
}
