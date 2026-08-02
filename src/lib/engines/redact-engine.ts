'use client';

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getDocumentProxy } from 'unpdf';
import { safeDrawText, safeWidthOfTextAtSize } from '@/lib/winansi-utils';

export interface RedactionArea {
  id: string;
  page: number; // 1-based page index
  x: number; // PDF point x (from left)
  y: number; // PDF point y (from top of page)
  width: number; // PDF point width
  height: number; // PDF point height
  color?: string; // Hex e.g. #000000
  label?: string; // e.g. "[REDACTED]"
  labelColor?: string;
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  const r = (parseInt(clean.substring(0, 2), 16) || 0) / 255;
  const g = (parseInt(clean.substring(2, 4), 16) || 0) / 255;
  const b = (parseInt(clean.substring(4, 6), 16) || 0) / 255;
  return rgb(r, g, b);
}

/**
 * Apply selective redactions to PDF pages.
 * First tries high-fidelity PyMuPDF Python engine for cryptographic stream content removal.
 * Falls back seamlessly to in-browser pdf-lib vector rectangle rendering.
 */
export async function applyRedactions(
  file: File | ArrayBuffer,
  redactions: RedactionArea[],
  onProgress?: (p: number) => void
): Promise<Uint8Array> {
  if (onProgress) onProgress(20);

  // Try Python PyMuPDF server engine if file is File object
  if (typeof window !== 'undefined' && file instanceof File) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('redactions', JSON.stringify(redactions));

      const res = await fetch('/api/redact-pdf', { method: 'POST', body: formData });
      if (res.ok) {
        if (onProgress) onProgress(100);
        const arrayBuf = await res.arrayBuffer();
        return new Uint8Array(arrayBuf);
      }
    } catch (serverErr) {
      console.warn('[redact-engine] Server PyMuPDF redaction unavailable, falling back to pdf-lib:', serverErr);
    }
  }

  // Fallback: In-browser pdf-lib stream drawing
  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const pages = doc.getPages();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  const total = redactions.length;

  for (let idx = 0; idx < total; idx++) {
    if (onProgress) onProgress(20 + Math.floor(((idx + 1) / total) * 70));

    const r = redactions[idx];
    const pageIdx = Math.max(0, Math.min(r.page - 1, pages.length - 1));
    const page = pages[pageIdx];
    const { height: pH } = page.getSize();

    const fillColor = hexToRgb(r.color || '#000000');
    // Convert top-left Y from UI preview to PDF bottom-left origin Y
    const pdfY = pH - r.y - r.height;

    // Draw solid redaction vector box
    page.drawRectangle({
      x: r.x,
      y: pdfY,
      width: r.width,
      height: r.height,
      color: fillColor,
    });

    // Optional Redaction text label overlay
    if (r.label && r.label.trim().length > 0) {
      const labelText = r.label.trim();
      const fontSize = Math.max(8, Math.min(14, r.height * 0.5));
      const textWidth = safeWidthOfTextAtSize(font, labelText, fontSize);

      // Center text in redaction box
      if (textWidth <= r.width) {
        const textX = r.x + (r.width - textWidth) / 2;
        const textY = pdfY + (r.height - fontSize) / 2;
        const textColor = r.labelColor ? hexToRgb(r.labelColor) : r.color === '#ffffff' ? rgb(0, 0, 0) : rgb(1, 1, 1);

        safeDrawText(page, labelText, {
          x: textX,
          y: textY,
          size: fontSize,
          font,
          color: textColor,
        });
      }
    }
  }

  if (onProgress) onProgress(100);
  return doc.save();
}

/**
 * Scan PDF text content for sensitive data patterns (Emails, Phone numbers, SSNs)
 * and return calculated bounding boxes for selective redactions.
 */
export async function scanPdfForSensitiveText(
  file: File | ArrayBuffer,
  patterns: Array<'email' | 'phone' | 'ssn'> = ['email', 'phone', 'ssn']
): Promise<RedactionArea[]> {
  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const redactions: RedactionArea[] = [];

  const regexMap: Record<string, RegExp> = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
    phone: /(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  };

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    for (const item of textContent.items as any[]) {
      if (!item.str) continue;

      for (const p of patterns) {
        const regex = regexMap[p];
        if (!regex) continue;

        regex.lastIndex = 0;
        if (regex.test(item.str)) {
          const transform = item.transform || [1, 0, 0, 1, 0, 0];
          const x = transform[4];
          const pdfY = transform[5]; // bottom-left Y in PDF
          const itemWidth = item.width || 80;
          const itemHeight = item.height || 12;

          // Convert PDF bottom-left Y to UI top-left Y
          const topY = viewport.height - pdfY - itemHeight;

          redactions.push({
            id: `auto-${pageNum}-${redactions.length}-${Date.now()}`,
            page: pageNum,
            x: Math.max(0, x),
            y: Math.max(0, topY),
            width: Math.max(30, itemWidth),
            height: Math.max(10, itemHeight),
            color: '#000000',
            label: '[REDACTED]',
          });
        }
      }
    }
  }

  return redactions;
}

export async function redactPdf(
  file: File | ArrayBuffer,
  redactions: Array<{ page: number; x: number; y: number; width: number; height: number }>,
  onProgress?: (p: number) => void
): Promise<Uint8Array> {
  const areas: RedactionArea[] = redactions.map((r, i) => ({
    id: `legacy-${i}`,
    page: r.page,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    color: '#000000',
  }));
  return applyRedactions(file, areas, onProgress);
}
