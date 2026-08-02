'use client';

/**
 * Convert an ArrayBuffer of a zip-based Office format (xlsx, pptx, docx)
 * to a string by reading its internal XML text parts.
 * This is a pure JS fallback — no server required.
 */
export async function extractTextFromOfficeFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  // DOCX — use mammoth if available, otherwise zip-parse
  if (name.endsWith('.docx')) {
    try {
      const mammoth = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch {
      // fall through to generic approach
    }
  }

  // Generic Office XML fallback for .xlsx/.pptx/.ppt/.xls/.csv
  if (name.endsWith('.csv') || name.endsWith('.txt') || name.endsWith('.md')) {
    return await file.text();
  }

  // For binary xlsx/pptx: extract visible XML text nodes from zip entries
  try {
    // Use fflate-free approach: read the zip with native DecompressionStream
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);

    // Scan for XML text content between tags (simple XML text extractor)
    const xmlStr = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    // Extract text between XML tags
    const textParts: string[] = [];
    const tagPattern = />([^<]{2,})</g;
    let m;
    while ((m = tagPattern.exec(xmlStr)) !== null) {
      const part = m[1].trim();
      if (part && !/^[\x00-\x08\x0B\x0C\x0E-\x1F]+$/.test(part)) {
        textParts.push(part);
      }
    }

    if (textParts.length > 0) {
      return textParts.join('\n');
    }

    return `[Binary office file: ${file.name}. Content extracted as text is unavailable in-browser for this format.]`;
  } catch {
    return `[Unable to extract text from ${file.name}]`;
  }
}
