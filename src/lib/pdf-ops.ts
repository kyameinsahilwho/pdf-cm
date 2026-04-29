'use client';

import { PDFDocument, degrees } from 'pdf-lib';

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

async function loadPdf(buffer: ArrayBuffer, name: string) {
  let doc;
  try {
    doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  } catch (e: any) {
    if (e.message.toLowerCase().includes('encrypted'))
      throw new Error(`"${name}" is encrypted.`);
    if (e.message.toLowerCase().includes('invalid pdf structure') || e.message.toLowerCase().includes('expected') || e.message.toLowerCase().includes('offset'))
      throw new Error(`"${name}" is not a valid PDF.`);
    throw e;
  }
  if (doc.isEncrypted) throw new Error(`"${name}" is encrypted.`);
  return doc;
}

export async function mergePdfs(
  files: { file: File; name: string }[],
  onProgress: (p: number) => void
): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    const buf = await files[i].file.arrayBuffer();
    const doc = await loadPdf(buf, files[i].name);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
    onProgress(((i + 1) / files.length) * 100);
  }
  return merged.save();
}

export async function restructurePdf(
  file: File,
  name: string,
  rows: number,
  cols: number,
  mode: 'horizontal' | 'vertical',
  onProgress: (p: number) => void
): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  const doc = await loadPdf(buf, name);
  const pages = doc.getPages();
  const total = pages.length;
  if (total === 0) throw new Error('PDF has no pages.');

  const newDoc = await PDFDocument.create();
  const perPage = rows * cols;

  for (let i = 0; i < total; i += perPage) {
    const chunk = pages.slice(i, Math.min(i + perPage, total));
    const { width: rW, height: rH } = chunk[0].getSize();
    const pg = newDoc.addPage([rW, rH]);
    const tW = rW / cols, tH = rH / rows;

    for (let j = 0; j < chunk.length; j++) {
      const { width: pW, height: pH } = chunk[j].getSize();
      const scale = Math.min(tW / pW, tH / pH);
      const ri = Math.floor(j / cols), ci = j % cols;
      let x, y;
      if (mode === 'horizontal') { x = ci * tW; y = rH - (ri + 1) * tH; }
      else { x = ri * tW; y = rH - (ci + 1) * tH; }
      const sW = pW * scale, sH = pH * scale;
      x += (tW - sW) / 2; y += (tH - sH) / 2;
      const emb = await newDoc.embedPage(chunk[j]);
      pg.drawPage(emb, { x, y, width: sW, height: sH });
    }
    onProgress(((i + chunk.length) / total) * 100);
  }
  return newDoc.save();
}

export async function rotatePdf(
  file: File,
  name: string,
  onProgress: (p: number) => void
): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  const doc = await loadPdf(buf, name);
  const pages = doc.getPages();
  if (pages.length === 0) throw new Error('PDF has no pages.');
  for (let i = 0; i < pages.length; i++) {
    pages[i].setRotation(degrees(pages[i].getRotation().angle + 90));
    onProgress(((i + 1) / pages.length) * 100);
  }
  return doc.save();
}

export async function extractPages(
  file: File,
  name: string,
  rangeStr: string,
  onProgress: (p: number) => void
): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  const doc = await loadPdf(buf, name);
  const total = doc.getPageCount();
  const indices = new Set<number>();

  for (const part of rangeStr.split(',').map((s) => s.trim())) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      if (isNaN(a) || isNaN(b)) continue;
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++)
        if (i >= 1 && i <= total) indices.add(i - 1);
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n) && n >= 1 && n <= total) indices.add(n - 1);
    }
  }
  if (indices.size === 0) throw new Error('No valid pages in range.');

  const sorted = [...indices].sort((a, b) => a - b);
  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(doc, sorted);
  for (let i = 0; i < copied.length; i++) {
    newDoc.addPage(copied[i]);
    onProgress(((i + 1) / copied.length) * 100);
  }
  return newDoc.save();
}

export async function mergeAndRestructure(
  files: { file: File; name: string }[],
  rows: number,
  cols: number,
  mode: 'horizontal' | 'vertical',
  onProgress: (p: number) => void
): Promise<Uint8Array> {
  // Phase 1: Merge
  const merged = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    const buf = await files[i].file.arrayBuffer();
    const doc = await loadPdf(buf, files[i].name);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
    onProgress(((i + 1) / files.length) * 50);
  }

  // Phase 2: Restructure
  const pages = merged.getPages();
  const total = pages.length;
  if (total === 0) throw new Error('Merged PDF has no pages.');
  const newDoc = await PDFDocument.create();
  const perPage = rows * cols;

  for (let i = 0; i < total; i += perPage) {
    const chunk = pages.slice(i, Math.min(i + perPage, total));
    const { width: rW, height: rH } = chunk[0].getSize();
    const pg = newDoc.addPage([rW, rH]);
    const tW = rW / cols, tH = rH / rows;

    for (let j = 0; j < chunk.length; j++) {
      const { width: pW, height: pH } = chunk[j].getSize();
      const scale = Math.min(tW / pW, tH / pH);
      const ri = Math.floor(j / cols), ci = j % cols;
      let x, y;
      if (mode === 'horizontal') { x = ci * tW; y = rH - (ri + 1) * tH; }
      else { x = ri * tW; y = rH - (ci + 1) * tH; }
      const sW = pW * scale, sH = pH * scale;
      x += (tW - sW) / 2; y += (tH - sH) / 2;
      const emb = await newDoc.embedPage(chunk[j]);
      pg.drawPage(emb, { x, y, width: sW, height: sH });
    }
    onProgress(50 + ((i + chunk.length) / total) * 50);
  }
  return newDoc.save();
}
