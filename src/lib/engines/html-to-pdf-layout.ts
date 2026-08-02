export const MAX_HTML_BYTES = 1_000_000;

export interface HtmlPdfBlock {
  text: string;
  kind: 'heading' | 'paragraph' | 'list-item' | 'pre';
  level?: number;
}

const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'caption', 'dd', 'div', 'dl', 'dt',
  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'header', 'hgroup', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'tbody', 'td', 'tfoot',
  'th', 'thead', 'tr', 'ul',
]);
const SKIPPED_TAGS = new Set(['base', 'embed', 'iframe', 'link', 'meta', 'object', 'script', 'style', 'svg', 'template']);

export function validateHtmlForPdf(html: string): void {
  if (typeof html !== 'string' || !html.trim()) {
    throw new Error('Enter HTML content before creating a PDF.');
  }

  if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) {
    throw new Error('HTML content must be 1 MB or smaller. Split large documents into smaller PDFs.');
  }
}

function normalizeText(value: string, preserveWhitespace = false): string {
  const decoded = decodeHtmlEntities(value.replace(/\u00a0/g, ' '));
  return preserveWhitespace ? decoded.replace(/\r\n?/g, '\n').trim() : decoded.replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value: string): string {
  const entities: Record<string, string> = {
    amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', ndash: '–', mdash: '—', quot: '"',
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, encoded) => {
    const lower = encoded.toLowerCase();
    if (lower[0] === '#') {
      const codePoint = lower[1] === 'x' ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10);
      if (Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
        try { return String.fromCodePoint(codePoint); } catch { return entity; }
      }
      return entity;
    }
    return entities[lower] ?? entity;
  });
}

function isTagStart(html: string, index: number): boolean {
  return html[index] === '<' && /[!/A-Za-z/]/.test(html[index + 1] ?? '');
}

function findTagEnd(html: string, start: number): number {
  let quote = '';
  for (let i = start + 1; i < html.length; i++) {
    const char = html[i];
    if (quote) {
      if (char === quote && html[i - 1] !== '\\') quote = '';
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return i;
    }
  }
  return -1;
}

function tagName(rawTag: string): string | null {
  const match = rawTag.match(/^<\s*\/?\s*([A-Za-z][\w:-]*)/);
  return match?.[1].toLowerCase() ?? null;
}

function isClosingTag(rawTag: string): boolean {
  return /^<\s*\//.test(rawTag);
}

function flushText(buffer: string[], stack: string[], blocks: HtmlPdfBlock[]): void {
  const raw = buffer.join('');
  buffer.length = 0;
  if (!raw) return;

  const current = stack[stack.length - 1] ?? 'p';
  const headingMatch = current.match(/^h([1-6])$/);
  const kind: HtmlPdfBlock['kind'] = headingMatch ? 'heading' : current === 'li' ? 'list-item' : current === 'pre' ? 'pre' : 'paragraph';
  const text = normalizeText(raw, kind === 'pre');
  if (text) blocks.push({ text: kind === 'list-item' ? `• ${text}` : text, kind, level: headingMatch ? Number(headingMatch[1]) : undefined });
}

export function extractHtmlBlocks(html: string): string[] {
  return extractHtmlPdfBlocks(html).map((block) => block.text);
}

export function extractHtmlPdfBlocks(html: string): HtmlPdfBlock[] {
  validateHtmlForPdf(html);
  const blocks: HtmlPdfBlock[] = [];
  const stack: string[] = [];
  const ignoredStack: string[] = [];
  const textBuffer: string[] = [];

  for (let index = 0; index < html.length;) {
    if (!isTagStart(html, index)) {
      if (ignoredStack.length === 0) textBuffer.push(html[index]);
      index++;
      continue;
    }

    const end = findTagEnd(html, index);
    if (end === -1) {
      textBuffer.push(html.slice(index));
      break;
    }

    const rawTag = html.slice(index, end + 1);
    const name = tagName(rawTag);
    if (!name) {
      index = end + 1;
      continue;
    }

    const closing = isClosingTag(rawTag);
    const selfClosing = /\/\s*>$/.test(rawTag) || ['br', 'hr', 'img', 'input', 'source', 'wbr'].includes(name);

    if (SKIPPED_TAGS.has(name)) {
      if (!closing && !selfClosing) ignoredStack.push(name);
      if (closing && ignoredStack.at(-1) === name) ignoredStack.pop();
      index = end + 1;
      continue;
    }
    if (ignoredStack.length > 0) {
      index = end + 1;
      continue;
    }

    if (name === 'br' || name === 'hr') {
      flushText(textBuffer, stack, blocks);
    } else if (!closing && BLOCK_TAGS.has(name)) {
      flushText(textBuffer, stack, blocks);
      stack.push(name);
    } else if (closing && BLOCK_TAGS.has(name)) {
      flushText(textBuffer, stack, blocks);
      const stackIndex = stack.lastIndexOf(name);
      if (stackIndex >= 0) stack.splice(stackIndex, 1);
    }
    index = end + 1;
  }

  flushText(textBuffer, stack, blocks);
  return blocks;
}

export function wrapTextForPdf(text: string, maxWidth: number, measure: (value: string) => number): string[] {
  if (!text) return [];
  if (maxWidth <= 0) throw new Error('PDF layout width must be positive.');

  const lines: string[] = [];
  let line = '';
  const pushLine = () => {
    if (line) lines.push(line);
    line = '';
  };

  for (const token of text.split(/(\s+)/)) {
    if (!token) continue;
    if (/^\s+$/.test(token)) {
      if (line && !line.endsWith(' ')) line += ' ';
      continue;
    }

    const candidate = line ? `${line}${token}` : token;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }

    pushLine();
    if (measure(token) <= maxWidth) {
      line = token;
      continue;
    }

    let segment = '';
    for (const character of Array.from(token)) {
      if (segment && measure(`${segment}${character}`) > maxWidth) {
        lines.push(segment);
        segment = character;
      } else {
        segment += character;
      }
    }
    line = segment;
  }

  pushLine();
  return lines;
}
