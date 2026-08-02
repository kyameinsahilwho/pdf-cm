'use client';

import { getDocumentProxy } from 'unpdf';

export interface PageViewportInfo {
  width: number; // original PDF point width
  height: number; // original PDF point height
  pageCount: number;
}

export interface FullPdfMetadata {
  pageCount: number;
  fileName: string;
  fileSizeFormatted: string;
  fileSizeBytes: number;
  lastModifiedFormatted: string;
  fileType: string;
  widthPt: number;
  heightPt: number;
  widthIn: string;
  heightIn: string;
  widthMm: number;
  heightMm: number;
  paperFormat: string;
  orientation: 'Portrait' | 'Landscape';
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  isEncrypted?: boolean;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getPaperFormatName(widthPt: number, heightPt: number): string {
  const w = Math.min(widthPt, heightPt);
  const h = Math.max(widthPt, heightPt);

  if (Math.abs(w - 595.28) < 15 && Math.abs(h - 841.89) < 15) return 'A4';
  if (Math.abs(w - 612) < 15 && Math.abs(h - 792) < 15) return 'Letter';
  if (Math.abs(w - 612) < 15 && Math.abs(h - 1008) < 15) return 'Legal';
  if (Math.abs(w - 841.89) < 15 && Math.abs(h - 1190.55) < 15) return 'A3';
  if (Math.abs(w - 522) < 15 && Math.abs(h - 756) < 15) return 'Executive';
  if (Math.abs(w - 792) < 15 && Math.abs(h - 1224) < 15) return 'Tabloid';
  return 'Custom Size';
}

export async function getPdfInfo(file: File | ArrayBuffer): Promise<{ pageCount: number }> {
  try {
    const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    return { pageCount: pdf.numPages };
  } catch (_) {
    return { pageCount: 1 };
  }
}

export async function getFullPdfMetadata(file: File): Promise<FullPdfMetadata> {
  const fileSizeBytes = file.size;
  const fileSizeFormatted = formatFileSize(fileSizeBytes);
  const lastModifiedFormatted = file.lastModified
    ? new Date(file.lastModified).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown';

  let pageCount = 1;
  let widthPt = 612;
  let heightPt = 792;
  let title = '';
  let author = '';
  let subject = '';
  let creator = '';
  let producer = '';
  let creationDate = '';
  let isEncrypted = false;

  if (file.type.startsWith('image/')) {
    return {
      pageCount: 1,
      fileName: file.name,
      fileSizeFormatted,
      fileSizeBytes,
      lastModifiedFormatted,
      fileType: file.type || 'Image File',
      widthPt: 612,
      heightPt: 792,
      widthIn: '8.5',
      heightIn: '11.0',
      widthMm: 216,
      heightMm: 279,
      paperFormat: 'Image Asset',
      orientation: 'Portrait',
      isEncrypted: false,
    };
  }

  try {
    const buf = await file.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    pageCount = pdf.numPages;

    if (pageCount > 0) {
      const firstPage = await pdf.getPage(1);
      const vp = firstPage.getViewport({ scale: 1.0 });
      widthPt = Math.round(vp.width);
      heightPt = Math.round(vp.height);
    }

    try {
      const meta = await pdf.getMetadata();
      const info = meta?.info as Record<string, any> | undefined;
      if (info) {
        title = info.Title || '';
        author = info.Author || '';
        subject = info.Subject || '';
        creator = info.Creator || '';
        producer = info.Producer || '';
        creationDate = info.CreationDate || '';
      }
    } catch (_) {}
  } catch (e: any) {
    const msg = (e?.message || '').toLowerCase();
    if (msg.includes('password') || msg.includes('encrypted')) {
      isEncrypted = true;
    }
  }

  const widthIn = (widthPt / 72).toFixed(1);
  const heightIn = (heightPt / 72).toFixed(1);
  const widthMm = Math.round(widthPt * 0.352778);
  const heightMm = Math.round(heightPt * 0.352778);
  const orientation = widthPt > heightPt ? 'Landscape' : 'Portrait';
  const paperFormat = getPaperFormatName(widthPt, heightPt);

  return {
    pageCount,
    fileName: file.name,
    fileSizeFormatted,
    fileSizeBytes,
    lastModifiedFormatted,
    fileType: file.type || 'application/pdf',
    widthPt,
    heightPt,
    widthIn,
    heightIn,
    widthMm,
    heightMm,
    paperFormat,
    orientation,
    title,
    author,
    subject,
    creator,
    producer,
    creationDate,
    isEncrypted,
  };
}

export async function renderPageToCanvas(
  file: File | ArrayBuffer,
  pageNum: number,
  canvas: HTMLCanvasElement,
  scale = 1.2
): Promise<PageViewportInfo> {
  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context for canvas');

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
    canvas: canvas,
  };

  await page.render(renderContext).promise;

  // Unscaled original PDF point size
  const originalViewport = page.getViewport({ scale: 1.0 });

  return {
    width: originalViewport.width,
    height: originalViewport.height,
    pageCount: pdf.numPages,
  };
}
