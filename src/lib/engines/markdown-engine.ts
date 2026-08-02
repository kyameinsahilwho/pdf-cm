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

  try {
    const formData = new FormData();
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      formData.append('file', new Blob([file], { type: 'application/pdf' }), 'document.pdf');
    }

    const res = await fetch('/api/pdf-to-markdown', { method: 'POST', body: formData });
    if (res.ok) {
      if (onProgress) onProgress(100);
      const text = await res.text();
      return text;
    }
  } catch (err) {
    console.warn('[pdfToMarkdown] Python API unreachable, using client fallback:', err);
  }

  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const numPages = pdf.numPages;

  let fullMarkdown = `# ${file instanceof File ? file.name.replace(/\.[^/.]+$/, '') : 'Extracted Document'}\n\n`;

  for (let i = 1; i <= numPages; i++) {
    if (onProgress) onProgress(15 + Math.floor((i / numPages) * 75));

    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    fullMarkdown += `\n<!-- Page ${i} -->\n`;
    if (numPages > 1) {
      fullMarkdown += `\n## Page ${i}\n\n`;
    }

    if (!textContent.items || textContent.items.length === 0) {
      fullMarkdown += `*(No extractable text found on page ${i})*\n\n`;
      continue;
    }

    // Group items by line based on Y position (rounded)
    const linesMap = new Map<number, Array<{ str: string; x: number; height: number }>>();

    for (const item of textContent.items as any[]) {
      if (!item.str || item.str.trim().length === 0) continue;

      const y = Math.round((item.transform ? item.transform[5] : 0) / 4) * 4;
      const x = item.transform ? item.transform[4] : 0;
      const height = item.height || 10;

      if (!linesMap.has(y)) {
        linesMap.set(y, []);
      }
      linesMap.get(y)!.push({ str: item.str, x, height });
    }

    // Sort Y lines descending (top of page to bottom)
    const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);

    let inList = false;

    for (const y of sortedY) {
      const items = linesMap.get(y)!;
      // Sort items left-to-right by X position
      items.sort((a, b) => a.x - b.x);

      const lineText = items.map((it) => it.str).join(' ').trim();
      if (!lineText) continue;

      const avgHeight = items.reduce((acc, curr) => acc + curr.height, 0) / items.length;

      // Heuristic for Heading vs Paragraph vs List
      if (avgHeight >= 16 && lineText.length < 80) {
        fullMarkdown += `\n# ${lineText}\n\n`;
        inList = false;
      } else if (avgHeight >= 13 && lineText.length < 100) {
        fullMarkdown += `\n### ${lineText}\n\n`;
        inList = false;
      } else if (/^[\bullet\-\*•]\s+/.test(lineText) || /^\d+[\.\)]\s+/.test(lineText)) {
        fullMarkdown += `${lineText}\n`;
        inList = true;
      } else if (/^[A-Z0-9\s]{4,60}$/.test(lineText) && lineText.length < 60) {
        fullMarkdown += `\n#### ${lineText}\n\n`;
        inList = false;
      } else {
        if (inList) {
          fullMarkdown += '\n';
          inList = false;
        }
        fullMarkdown += `${lineText}\n\n`;
      }
    }
  }

  if (onProgress) onProgress(100);
  return fullMarkdown.trim();
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
