'use client';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getDocumentProxy } from 'unpdf';
import { safeDrawText, safeWidthOfTextAtSize, sanitizeWinAnsi } from '@/lib/winansi-utils';

/**
 * High-fidelity PDF to Markdown converter.
 * Extracts real text page by page, identifies structure (headings, lists, code blocks, paragraphs)
 * and formats clean Markdown output.
 */
export async function pdfToMarkdown(
  file: File | ArrayBuffer,
  onProgress?: (p: number) => void
): Promise<string> {
  if (onProgress) onProgress(10);

  const formData = new FormData();
  if (file instanceof File) {
    formData.append('file', file);
  } else {
    formData.append('file', new Blob([file], { type: 'application/pdf' }), 'document.pdf');
  }

  const res = await fetch('/api/pdf-to-markdown', { method: 'POST', body: formData });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.details || `PDF to Markdown conversion failed with status ${res.status}`);
  }

  if (onProgress) onProgress(100);
  const text = await res.text();
  return text;
}

/**
 * Markdown to PDF compiler.
 * Renders structured Markdown text into a cleanly styled PDF document.
 */
export async function markdownToPdf(
  markdownStr: string,
  title = 'Document',
  onProgress?: (p: number) => void
): Promise<Uint8Array> {
  if (onProgress) onProgress(20);

  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  let currentPage = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const lines = markdownStr.split('\n');
  const totalLines = lines.length;

  for (let idx = 0; idx < totalLines; idx++) {
    if (onProgress) onProgress(20 + Math.floor((idx / totalLines) * 75));

    const rawLine = lines[idx].trim();
    if (!rawLine) {
      y -= 12;
      if (y < margin + 20) {
        currentPage = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      continue;
    }

    let fontSize = 11;
    let font = fontRegular;
    let color = rgb(0.15, 0.15, 0.15);
    let lineContent = rawLine;
    let indent = 0;

    if (rawLine.startsWith('# ')) {
      fontSize = 22;
      font = fontBold;
      color = rgb(0.88, 0.11, 0.28); // Rose primary accent
      lineContent = rawLine.replace(/^#\s+/, '');
      y -= 8;
    } else if (rawLine.startsWith('## ')) {
      fontSize = 17;
      font = fontBold;
      color = rgb(0.1, 0.1, 0.2);
      lineContent = rawLine.replace(/^##\s+/, '');
      y -= 6;
    } else if (rawLine.startsWith('### ')) {
      fontSize = 14;
      font = fontBold;
      color = rgb(0.2, 0.2, 0.3);
      lineContent = rawLine.replace(/^###\s+/, '');
      y -= 4;
    } else if (rawLine.startsWith('#### ')) {
      fontSize = 12;
      font = fontBold;
      color = rgb(0.3, 0.3, 0.4);
      lineContent = rawLine.replace(/^####\s+/, '');
    } else if (rawLine.startsWith('- ') || rawLine.startsWith('* ')) {
      lineContent = `• ${rawLine.substring(2)}`;
      indent = 15;
    } else if (/^\d+\.\s+/.test(rawLine)) {
      indent = 15;
    }

    // Strip remaining markdown formatting characters and sanitize WinAnsi
    const cleanText = sanitizeWinAnsi(lineContent.replace(/[\*_`]/g, ''), font);

    // Wrap long lines into multiple sublines
    const words = cleanText.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = safeWidthOfTextAtSize(font, testLine, fontSize);

      if (width > contentWidth - indent) {
        if (y < margin + fontSize + 10) {
          currentPage = doc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }

        safeDrawText(currentPage, currentLine, {
          x: margin + indent,
          y,
          size: fontSize,
          font,
          color,
        });

        y -= fontSize + 4;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      if (y < margin + fontSize + 10) {
        currentPage = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }

      safeDrawText(currentPage, currentLine, {
        x: margin + indent,
        y,
        size: fontSize,
        font,
        color,
      });

      y -= fontSize + 6;
    }
  }

  if (onProgress) onProgress(100);
  return doc.save();
}
