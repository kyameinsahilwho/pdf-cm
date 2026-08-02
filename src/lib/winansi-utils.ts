'use client';

/**
 * Sanitize a string so it can be safely encoded with pdf-lib standard fonts (Helvetica, Times, Courier).
 * Replaces non-encodable Unicode characters, emojis, smart quotes, dashes, and unsupported symbols.
 */
export function sanitizeWinAnsi(text: string, font?: any): string {
  if (!text) return '';

  // 1. Common Unicode replacements to retain maximum readability
  let str = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 2. Remove surrogate pairs (Emojis, symbols)
  str = str.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');

  // 3. Test character-by-character against font.encodeText if font object is available
  if (font && typeof font.encodeText === 'function') {
    let safeStr = '';
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      try {
        font.encodeText(char);
        safeStr += char;
      } catch {
        const code = char.charCodeAt(0);
        if (code >= 32 && code <= 126) {
          safeStr += char;
        } else {
          safeStr += ' ';
        }
      }
    }
    return safeStr;
  }

  // 4. Fallback ASCII printable filtering
  return str.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
}

/**
 * Measure text width safely without throwing WinAnsi encoding errors.
 */
export function safeWidthOfTextAtSize(font: any, text: string, fontSize: number): number {
  const clean = sanitizeWinAnsi(text, font);
  if (!clean) return 0;
  try {
    return font.widthOfTextAtSize(clean, fontSize);
  } catch {
    return clean.length * fontSize * 0.5;
  }
}

/**
 * Draw text onto a PDF page safely without throwing WinAnsi encoding errors.
 */
export function safeDrawText(
  page: any,
  text: string,
  options: {
    x: number;
    y: number;
    size: number;
    font: any;
    color?: any;
    opacity?: number;
    rotate?: any;
  }
) {
  const clean = sanitizeWinAnsi(text, options.font);
  if (!clean || clean.trim().length === 0) return;

  try {
    page.drawText(clean, {
      ...options,
    });
  } catch (e) {
    // Ultimate fallback with ASCII sanitization
    const asciiText = clean.replace(/[^\x20-\x7E]/g, '?');
    if (asciiText.trim().length > 0) {
      page.drawText(asciiText, {
        ...options,
      });
    }
  }
}
