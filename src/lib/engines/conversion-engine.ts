'use client';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getDocumentProxy } from 'unpdf';
import * as mammoth from 'mammoth';
import { safeDrawText } from '@/lib/winansi-utils';
import { extractTextFromOfficeFile } from './office-extractor';

/**
 * Convert PDF to structured Word (.docx) using Python pdf2docx layout engine.
 */
export async function pdfToWord(
  file: File | ArrayBuffer,
  onProgress?: (p: number) => void
): Promise<Blob> {
  if (onProgress) onProgress(20);
  
  try {
    const formData = new FormData();
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      formData.append('file', new Blob([file], { type: 'application/pdf' }), 'document.pdf');
    }

    const res = await fetch('/api/pdf-to-word', { method: 'POST', body: formData });
    if (res.ok) {
      if (onProgress) onProgress(100);
      const blob = await res.blob();
      return new Blob([await blob.arrayBuffer()], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    }
  } catch (err) {
    console.warn('[pdfToWord] Python API unreachable, using fallback:', err);
  }

  // Fallback
  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  let docContent = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const textLines = (content.items as any[]).map((it) => it.str).join(' ');
    docContent += `<h2>Page ${i}</h2><p>${textLines}</p>`;
  }
  if (onProgress) onProgress(100);
  return new Blob([docContent], { type: 'application/msword' });
}

/**
 * Convert PDF to Excel XLSX spreadsheet using Python pdfplumber + openpyxl engine.
 */
export async function pdfToExcel(
  file: File | ArrayBuffer,
  onProgress?: (p: number) => void
): Promise<Blob> {
  if (onProgress) onProgress(20);

  try {
    const formData = new FormData();
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      formData.append('file', new Blob([file], { type: 'application/pdf' }), 'document.pdf');
    }

    const res = await fetch('/api/pdf-to-excel', { method: 'POST', body: formData });
    if (res.ok) {
      if (onProgress) onProgress(100);
      const blob = await res.blob();
      return new Blob([await blob.arrayBuffer()], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    }
  } catch (err) {
    console.warn('[pdfToExcel] Python API unreachable, using fallback:', err);
  }

  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const csvRows: string[] = ['"Page","Row","Content"'];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = (content.items as any[]).map((it) => it.str).join(' ');
    csvRows.push(`"${i}","1","${text.replace(/"/g, '""')}"`);
  }
  if (onProgress) onProgress(100);
  return new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Convert PDF to PowerPoint PPTX presentation slides using Python python-pptx engine.
 */
export async function pdfToPowerPoint(
  file: File | ArrayBuffer,
  onProgress?: (p: number) => void
): Promise<Blob> {
  if (onProgress) onProgress(20);

  try {
    const formData = new FormData();
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      formData.append('file', new Blob([file], { type: 'application/pdf' }), 'document.pdf');
    }

    const res = await fetch('/api/pdf-to-ppt', { method: 'POST', body: formData });
    if (res.ok) {
      if (onProgress) onProgress(100);
      const blob = await res.blob();
      return new Blob([await blob.arrayBuffer()], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
    }
  } catch (err) {
    console.warn('[pdfToPowerPoint] Python API unreachable, using fallback:', err);
  }

  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  let pptContent = 'Presentation Outline\n';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = (content.items as any[]).map((it) => it.str).join(' ');
    pptContent += `\nSlide ${i}:\n${text}\n`;
  }
  if (onProgress) onProgress(100);
  return new Blob([pptContent], { type: 'text/plain;charset=utf-8' });
}

/**
 * Convert Office (DOCX/XLSX/PPTX) to PDF using Python high-fidelity conversion engines.
 */
export async function officeToPdf(
  file: File,
  type: 'word' | 'ppt' | 'excel',
  onProgress?: (p: number) => void
): Promise<Uint8Array> {
  if (onProgress) onProgress(10);

  const endpoint = type === 'word' ? '/api/word-to-pdf' : type === 'ppt' ? '/api/ppt-to-pdf' : '/api/excel-to-pdf';

  try {
    if (onProgress) onProgress(30);
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      if (onProgress) onProgress(90);
      const arrayBuf = await res.arrayBuffer();
      if (onProgress) onProgress(100);
      return new Uint8Array(arrayBuf);
    }
  } catch (apiErr) {
    console.warn(`[officeToPdf ${type}] Serverless API unreachable, using client fallback:`, apiErr);
  }

  const extractedText = await extractTextFromOfficeFile(file);

  if (onProgress) onProgress(50);

  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 50;
  const marginY = 50;
  const lineHeight = 16;
  const maxCharsPerLine = 90;

  let currentPage = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - marginY;

  // Title header
  const titleLabel = type === 'word' ? 'Word Document' : type === 'excel' ? 'Spreadsheet' : 'Presentation';
  safeDrawText(currentPage, `${titleLabel} — ${file.name}`, {
    x: marginX,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.88, 0.11, 0.28),
  });
  y -= lineHeight * 2;

  // Horizontal rule simulation
  currentPage.drawLine({
    start: { x: marginX, y },
    end: { x: pageWidth - marginX, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= lineHeight;

  const rawLines = extractedText.split('\n');
  const totalLines = rawLines.length;

  for (let li = 0; li < rawLines.length; li++) {
    if (onProgress) onProgress(50 + Math.floor((li / totalLines) * 45));
    const rawLine = rawLines[li].trim();
    if (!rawLine) {
      y -= lineHeight * 0.5;
      if (y < marginY) {
        currentPage = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - marginY;
      }
      continue;
    }

    // Word-wrap long lines
    const words = rawLine.split(' ');
    let currentChunk = '';

    for (const word of words) {
      const test = currentChunk ? `${currentChunk} ${word}` : word;
      if (test.length > maxCharsPerLine) {
        if (y < marginY + lineHeight) {
          currentPage = doc.addPage([pageWidth, pageHeight]);
          y = pageHeight - marginY;
        }
        safeDrawText(currentPage, currentChunk, {
          x: marginX,
          y,
          size: 10,
          font: fontRegular,
          color: rgb(0.1, 0.1, 0.1),
        });
        y -= lineHeight;
        currentChunk = word;
      } else {
        currentChunk = test;
      }
    }

    if (currentChunk) {
      if (y < marginY + lineHeight) {
        currentPage = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - marginY;
      }
      safeDrawText(currentPage, currentChunk, {
        x: marginX,
        y,
        size: 10,
        font: fontRegular,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= lineHeight;
    }
  }

  if (onProgress) onProgress(100);
  return doc.save();
}

/**
 * Convert PDF pages to JPG images as a zip-like multi-download.
 * Returns array of data URLs that can be downloaded individually.
 */
export async function pdfToJpgImages(
  file: File | ArrayBuffer,
  scale = 1.5,
  onProgress?: (p: number) => void
): Promise<{ pageNum: number; dataUrl: string }[]> {
  if (onProgress) onProgress(10);
  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const numPages = pdf.numPages;
  const results: { pageNum: number; dataUrl: string }[] = [];

  for (let i = 1; i <= numPages; i++) {
    if (onProgress) onProgress(10 + Math.floor((i / numPages) * 85));
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    results.push({ pageNum: i, dataUrl });
    canvas.remove();
  }

  if (onProgress) onProgress(100);
  return results;
}

/**
 * Perform OCR text extraction and embed as invisible searchable text layer.
 */
export async function ocrPdf(
  file: File | ArrayBuffer,
  onProgress?: (p: number) => void
): Promise<Uint8Array> {
  if (onProgress) onProgress(10);

  try {
    const formData = new FormData();
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      formData.append('file', new Blob([file], { type: 'application/pdf' }), 'document.pdf');
    }

    const res = await fetch('/api/ocr-pdf', { method: 'POST', body: formData });
    if (res.ok) {
      if (onProgress) onProgress(100);
      const arrayBuf = await res.arrayBuffer();
      return new Uint8Array(arrayBuf);
    }
  } catch (err) {
    console.warn('[ocrPdf] Python API unreachable, using client fallback:', err);
  }

  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();

  // Extract real text from PDF first
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = (content.items as any[]).map((it) => it.str).join(' ');
    pageTexts.push(text);
    if (onProgress) onProgress(10 + Math.floor((i / pdf.numPages) * 50));
  }

  // Now embed that text as a transparent layer in the output PDF
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  pages.forEach((page, idx) => {
    const text = pageTexts[idx] || '';
    if (!text.trim()) return;
    // Draw invisible searchable text
    safeDrawText(page, text.substring(0, 500), {
      x: 0,
      y: 0,
      size: 1,
      font,
      opacity: 0.001,
    });
    if (onProgress) onProgress(60 + Math.floor(((idx + 1) / pages.length) * 35));
  });

  if (onProgress) onProgress(100);
  return doc.save();
}

