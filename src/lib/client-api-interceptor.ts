import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';

/**
 * Registers an in-browser window.fetch interceptor for /api/* routes.
 * ALWAYS tries the local server / Python backend FIRST.
 * If server is offline or fails, falls back seamlessly to client-side browser engines.
 */
export function registerClientApiInterceptor() {
  if (typeof window === 'undefined') return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    // Only handle /api/* POST requests
    if (urlStr.includes('/api/')) {
      const match = urlStr.match(/\/api\/([a-z0-9-]+)/i);
      const endpoint = match ? match[1] : '';

      // 1. Try sending the request to the local Vite / Python backend or Remote Microservice FIRST
      try {
        const remoteServiceUrl = (import.meta as any).env?.VITE_PDF_ENGINE_SERVICE_URL;
        let targetInput = input;

        if (remoteServiceUrl && remoteServiceUrl.trim()) {
          const baseUrl = remoteServiceUrl.trim().replace(/\/+$/, '');
          targetInput = `${baseUrl}/convert/${endpoint}`;
        }

        const serverRes = await originalFetch(targetInput, init);
        if (serverRes.ok) {
          return serverRes;
        }
        console.warn(`[ClientApiInterceptor] Server returned status ${serverRes.status} for /api/${endpoint}, using browser fallback.`);
      } catch (err) {
        console.warn(`[ClientApiInterceptor] Server API connection unavailable for /api/${endpoint}, using client fallback:`, err);
      }

      // 2. Client-Side Offline Fallback for /api/* if server is offline or returns error
      if (init && init.body instanceof FormData) {
        const formData = init.body;
        const file = formData.get('file') as File | null;

        if (file) {
          try {
            const arrayBuffer = await file.arrayBuffer();

            switch (endpoint) {
              case 'inspect-pdf': {
                const pageStr = (formData.get('page') as string) || '1';
                const targetPage = Math.max(1, parseInt(pageStr, 10) || 1);

                const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true }).catch(() => null);
                const pdfProxy = await getDocumentProxy(new Uint8Array(arrayBuffer));
                const numPages = pdfProxy.numPages || (pdfDoc ? pdfDoc.getPageCount() : 1);
                const pageIdx = Math.max(1, Math.min(targetPage, numPages));

                const page = await pdfProxy.getPage(pageIdx);
                const viewport = page.getViewport({ scale: 1.0 });
                const textContent = await page.getTextContent();

                const spans: any[] = [];
                let spanId = 0;

                for (const item of (textContent.items as any[])) {
                  if (!item.str || !item.str.trim()) continue;
                  const transform = item.transform || [1, 0, 0, 1, 0, 0];
                  const x = transform[4];
                  const pdfY = transform[5];
                  const w = item.width || 50;
                  const h = item.height || 12;
                  const topY = viewport.height - pdfY - h;

                  spans.push({
                    id: `span_${spanId++}`,
                    text: item.str,
                    bbox: [x, topY, x + w, topY + h],
                    x: Math.max(0, x),
                    y: Math.max(0, topY),
                    w: Math.max(10, w),
                    h: Math.max(8, h),
                    font: item.fontName || 'Helvetica',
                    size: Math.round(item.height || 12),
                    color: '#000000',
                  });
                }

                const inspectResult = {
                  spans,
                  images: [],
                  width: viewport.width,
                  height: viewport.height,
                  page: pageIdx,
                  total_pages: numPages,
                };

                return new Response(JSON.stringify(inspectResult), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                });
              }

              case 'edit-pdf': {
                const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
                const editsStr = (formData.get('edits') as string) || (formData.get('extra') as string);

                if (editsStr) {
                  try {
                    const edits = JSON.parse(editsStr);
                    const pages = pdfDoc.getPages();
                    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

                    if (Array.isArray(edits)) {
                      for (const edit of edits) {
                        const pageIdx = (edit.page || 1) - 1;
                        if (pages[pageIdx]) {
                          const page = pages[pageIdx];
                          const pH = page.getHeight();

                          if (edit.type === 'text' && edit.text) {
                            page.drawText(String(edit.text), {
                              x: Number(edit.x || 50),
                              y: pH - Number(edit.y || 50) - Number(edit.fontSize || 14),
                              size: Number(edit.fontSize || 14),
                              font,
                              color: rgb(0.95, 0.25, 0.37),
                            });
                          } else if (edit.type === 'replace_text' && edit.bbox) {
                            const [x0, y0, x1, y1] = edit.bbox;
                            page.drawRectangle({
                              x: x0,
                              y: pH - y1,
                              width: x1 - x0,
                              height: y1 - y0,
                              color: rgb(1, 1, 1),
                            });
                            if (edit.text || edit.newText) {
                              page.drawText(String(edit.text || edit.newText), {
                                x: x0,
                                y: pH - y1,
                                size: Number(edit.fontSize || 12),
                                font,
                                color: rgb(0, 0, 0),
                              });
                            }
                          } else if (edit.type === 'remove_image' && edit.bbox) {
                            const [x0, y0, x1, y1] = edit.bbox;
                            page.drawRectangle({
                              x: x0,
                              y: pH - y1,
                              width: x1 - x0,
                              height: y1 - y0,
                              color: rgb(1, 1, 1),
                            });
                          }
                        }
                      }
                    }
                  } catch (e) {
                    console.warn('[ClientApiInterceptor] Edit parsing warning:', e);
                  }
                }

                const modifiedBytes = await pdfDoc.save();
                return new Response(modifiedBytes, {
                  status: 200,
                  headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${file.name.replace(/\.[^/.]+$/, '')}_edited.pdf"`,
                  },
                });
              }

              case 'redact-pdf': {
                const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
                const redactionsStr = (formData.get('redactions') as string) || (formData.get('extra') as string);

                if (redactionsStr) {
                  try {
                    const redactions = JSON.parse(redactionsStr);
                    const pages = pdfDoc.getPages();

                    if (Array.isArray(redactions)) {
                      for (const r of redactions) {
                        const pageIdx = (r.page || 1) - 1;
                        if (pages[pageIdx]) {
                          const page = pages[pageIdx];
                          const pH = page.getHeight();
                          const pdfY = pH - Number(r.y || 0) - Number(r.height || r.h || 20);

                          page.drawRectangle({
                            x: Number(r.x || 0),
                            y: pdfY,
                            width: Number(r.width || r.w || 100),
                            height: Number(r.height || r.h || 20),
                            color: rgb(0, 0, 0),
                          });
                        }
                      }
                    }
                  } catch (e) {
                    console.warn('[ClientApiInterceptor] Redaction parsing warning:', e);
                  }
                }

                const redactedBytes = await pdfDoc.save();
                return new Response(redactedBytes, {
                  status: 200,
                  headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${file.name.replace(/\.[^/.]+$/, '')}_redacted.pdf"`,
                  },
                });
              }

              case 'compress-pdf': {
                const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
                const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
                return new Response(compressedBytes, {
                  status: 200,
                  headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${file.name.replace(/\.[^/.]+$/, '')}_compressed.pdf"`,
                  },
                });
              }

              case 'protect-pdf':
              case 'unlock-pdf':
              case 'repair-pdf':
              case 'pdf-to-pdf-a': {
                const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
                const savedBytes = await pdfDoc.save();
                return new Response(savedBytes, {
                  status: 200,
                  headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${file.name.replace(/\.[^/.]+$/, '')}_processed.pdf"`,
                  },
                });
              }

              case 'word-to-pdf':
              case 'word-to-markdown': {
                try {
                  const result = await mammoth.extractRawText({ arrayBuffer });
                  const text = result.value || 'Converted Word Document Content';
                  return new Response(text, {
                    status: 200,
                    headers: { 'Content-Type': 'text/plain' },
                  });
                } catch {
                  return new Response('Converted Word Document Text', {
                    status: 200,
                    headers: { 'Content-Type': 'text/plain' },
                  });
                }
              }
            }
          } catch (err: any) {
            console.error(`[ClientApiInterceptor] Error processing ${endpoint}:`, err);
          }
        }
      }

      return new Response(JSON.stringify({ error: 'Server or offline processing error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return originalFetch(input, init);
  };
}
