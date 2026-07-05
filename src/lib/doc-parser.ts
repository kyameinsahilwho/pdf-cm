'use client';

import * as mammoth from 'mammoth';

/**
 * Extract text from a PDF file using the `unpdf` package.
 * unpdf bundles PDF.js as a single self-contained module (no worker required).
 */
export async function extractTextFromPdf(
  file: File,
  onProgress?: (p: number) => void
): Promise<string> {
  if (onProgress) onProgress(10);

  // Dynamically import so Next.js doesn't try to SSR the heavy PDF bundle
  const { getDocumentProxy, extractText } = await import('unpdf');

  if (onProgress) onProgress(30);
  const arrayBuffer = await file.arrayBuffer();
  if (onProgress) onProgress(50);

  const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
  if (onProgress) onProgress(70);

  const { text } = await extractText(pdf, { mergePages: true });
  if (onProgress) onProgress(100);

  return text;
}

export async function extractTextFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export async function extractTextFromTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = () => reject(new Error('Failed to read text file'));
    reader.readAsText(file);
  });
}

export interface ParseResult {
  text: string;
  pagesCount: number;
}

export async function extractText(
  file: File,
  onProgress?: (p: number) => void
): Promise<ParseResult> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.pdf')) {
    const { getDocumentProxy } = await import('unpdf');
    if (onProgress) onProgress(10);
    const arrayBuffer = await file.arrayBuffer();
    if (onProgress) onProgress(40);
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
    const pagesCount = pdf.numPages;
    if (onProgress) onProgress(60);
    const { extractText: doExtract } = await import('unpdf');
    const { text } = await doExtract(pdf, { mergePages: true });
    if (onProgress) onProgress(100);
    return { text, pagesCount };
  }

  if (name.endsWith('.docx')) {
    if (onProgress) onProgress(30);
    const text = await extractTextFromDocx(file);
    if (onProgress) onProgress(100);
    const words = text.split(/\s+/).filter(Boolean).length;
    const pagesCount = Math.max(1, Math.ceil(words / 400));
    return { text, pagesCount };
  }

  // Fallback for txt, md, html, json, csv, code files, etc.
  if (onProgress) onProgress(30);
  const text = await extractTextFromTextFile(file);
  if (onProgress) onProgress(100);
  const words = text.split(/\s+/).filter(Boolean).length;
  const pagesCount = Math.max(1, Math.ceil(words / 400));
  return { text, pagesCount };
}
