import type { Plugin, ViteDevServer } from 'vite';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const execFileAsync = promisify(execFile);

/**
 * Executes python script api/index.py locally across Windows, Mac, Linux.
 * Tries `python`, `py`, and `python3` in order if command fails with ENOENT.
 */
async function runLocalPythonScript(
  scriptPath: string,
  args: string[],
  timeoutMs = 120000
): Promise<{ stdout: string; stderr: string }> {
  const executables = process.platform === 'win32'
    ? ['python', 'py', 'python3']
    : ['python3', 'python'];

  let lastError: any = null;

  for (const pyExec of executables) {
    try {
      return await execFileAsync(pyExec, [scriptPath, ...args], {
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024 * 50,
      });
    } catch (err: any) {
      lastError = err;
      if (err.code === 'ENOENT') continue;
      throw new Error(`Python execution error (${pyExec}): ${err.stderr || err.message}`);
    }
  }

  throw new Error(`Failed to locate Python executable (${executables.join(', ')}). Error: ${lastError?.message || lastError}`);
}

/**
 * Simple multipart/form-data parser for Node HTTP request
 */
function parseMultipartFormData(buffer: Buffer, boundary: string): { files: Map<string, { filename: string; data: Buffer }>; fields: Map<string, string> } {
  const files = new Map<string, { filename: string; data: Buffer }>();
  const fields = new Map<string, string>();

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = 0;

  while (true) {
    const idx = buffer.indexOf(boundaryBuffer, start);
    if (idx === -1) break;
    if (start > 0) {
      parts.push(buffer.subarray(start, idx - 2));
    }
    start = idx + boundaryBuffer.length + 2;
  }

  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headerText = part.subarray(0, headerEnd).toString('utf-8');
    const body = part.subarray(headerEnd + 4);

    const nameMatch = headerText.match(/name="([^"]+)"/);
    const filenameMatch = headerText.match(/filename="([^"]+)"/);

    if (nameMatch) {
      const fieldName = nameMatch[1];
      if (filenameMatch) {
        files.set(fieldName, { filename: filenameMatch[1], data: body });
      } else {
        fields.set(fieldName, body.toString('utf-8'));
      }
    }
  }

  return { files, fields };
}

const TOOL_CONFIG: Record<string, { defaultInputExt: string; outputExt: string; mimeType: string }> = {
  'compress-pdf': { defaultInputExt: '.pdf', outputExt: '.pdf', mimeType: 'application/pdf' },
  'edit-pdf': { defaultInputExt: '.pdf', outputExt: '.pdf', mimeType: 'application/pdf' },
  'inspect-pdf': { defaultInputExt: '.pdf', outputExt: '.json', mimeType: 'application/json' },
  'ocr-pdf': { defaultInputExt: '.pdf', outputExt: '.pdf', mimeType: 'application/pdf' },
  'pdf-to-word': { defaultInputExt: '.pdf', outputExt: '.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  'word-to-pdf': { defaultInputExt: '.docx', outputExt: '.pdf', mimeType: 'application/pdf' },
  'redact-pdf': { defaultInputExt: '.pdf', outputExt: '.pdf', mimeType: 'application/pdf' },
  'protect-pdf': { defaultInputExt: '.pdf', outputExt: '.pdf', mimeType: 'application/pdf' },
  'unlock-pdf': { defaultInputExt: '.pdf', outputExt: '.pdf', mimeType: 'application/pdf' },
  'repair-pdf': { defaultInputExt: '.pdf', outputExt: '.pdf', mimeType: 'application/pdf' },
  'html-to-pdf': { defaultInputExt: '.html', outputExt: '.pdf', mimeType: 'application/pdf' },
  'excel-to-pdf': { defaultInputExt: '.xlsx', outputExt: '.pdf', mimeType: 'application/pdf' },
  'pdf-to-excel': { defaultInputExt: '.pdf', outputExt: '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  'ppt-to-pdf': { defaultInputExt: '.pptx', outputExt: '.pdf', mimeType: 'application/pdf' },
  'pdf-to-ppt': { defaultInputExt: '.pdf', outputExt: '.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  'pdf-to-pdf-a': { defaultInputExt: '.pdf', outputExt: '.pdf', mimeType: 'application/pdf' },
  'pdf-to-markdown': { defaultInputExt: '.pdf', outputExt: '.md', mimeType: 'text/markdown' },
};

/**
 * Vite Dev Server Plugin mirroring Next.js handleConversionRequest & api/index.py behavior
 */
export function vitePythonConversionPlugin(repoRoot: string): Plugin {
  return {
    name: 'vite-python-conversion-plugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/') || req.method !== 'POST') {
          return next();
        }

        const match = req.url.match(/\/api\/([a-z0-9-]+)/i);
        const toolName = match ? match[1] : '';

        if (!toolName) return next();

        const toolCfg = TOOL_CONFIG[toolName] || {
          defaultInputExt: '.pdf',
          outputExt: '.pdf',
          mimeType: 'application/pdf',
        };

        // 1. Check for Render / Host Microservice URL
        const rawServiceUrl =
          process.env.PDF_ENGINE_SERVICE_URL ||
          process.env.WORD_TO_PDF_SERVICE_URL ||
          process.env.RENDER_CONVERSION_SERVICE_URL ||
          process.env.VITE_PDF_ENGINE_SERVICE_URL;

        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk as Buffer);
        }
        const fullBuffer = Buffer.concat(chunks);

        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : '';

        let inputBuffer: Buffer | null = null;
        let filename = `input_${toolName}${toolCfg.defaultInputExt}`;
        let redactions = '';
        let edits = '';
        let page = '';
        let password = '';
        let extraField = '';

        if (boundary) {
          const { files, fields } = parseMultipartFormData(fullBuffer, boundary);
          const fileItem = files.get('file');
          if (fileItem) {
            inputBuffer = fileItem.data;
            filename = fileItem.filename || filename;
          }
          redactions = fields.get('redactions') || '';
          edits = fields.get('edits') || '';
          page = fields.get('page') || '';
          password = fields.get('password') || '';
          extraField = fields.get('extra') || '';
        } else {
          inputBuffer = fullBuffer;
        }

        const extra = redactions || edits || page || password || extraField || '';

        // 1A. Forward to Render Cloud Microservice if URL is found
        if (rawServiceUrl && rawServiceUrl.trim() && inputBuffer) {
          try {
            let baseUrl = rawServiceUrl.trim().replace(/\/+$/, '');
            if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
              baseUrl = `https://${baseUrl}`;
            }
            const targetUrl = `${baseUrl}/convert/${toolName}`;

            const outboundFormData = new FormData();
            const blob = new Blob([inputBuffer]);
            outboundFormData.append('file', blob, filename);
            if (extra) outboundFormData.append('extra', extra);
            if (redactions) outboundFormData.append('redactions', redactions);
            if (edits) outboundFormData.append('edits', edits);
            if (page) outboundFormData.append('page', page);
            if (password) outboundFormData.append('password', password);

            const upstreamRes = await fetch(targetUrl, {
              method: 'POST',
              body: outboundFormData,
            });

            if (!upstreamRes.ok) {
              const errJson = await upstreamRes.json().catch(() => ({ error: 'Render conversion service error' }));
              res.statusCode = upstreamRes.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: errJson.error || `${toolName} conversion failed` }));
              return;
            }

            const fileBuffer = await upstreamRes.arrayBuffer();
            res.statusCode = 200;
            res.setHeader('Content-Type', toolCfg.mimeType);
            const originalName = filename.replace(/\.[^/.]+$/, '');
            const outFilename = `${originalName}${toolCfg.outputExt}`;
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(outFilename)}"`);
            res.end(Buffer.from(fileBuffer));
            return;
          } catch (err: any) {
            console.warn(`[VitePythonPlugin] Render microservice failed (${rawServiceUrl}), falling back to local Python runner:`, err.message);
          }
        }

        // 2. Local Python Runner using api/index.py
        const scriptPath = path.resolve(repoRoot, 'api', 'index.py');
        let tmpInPath = '';
        let tmpOutPath = '';

        try {
          if (!inputBuffer || inputBuffer.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'No file buffer provided in request' }));
            return;
          }

          const randomId = Math.random().toString(36).substring(2, 9);
          const tmpDir = os.tmpdir();
          const actualExt = path.extname(filename) || toolCfg.defaultInputExt;

          tmpInPath = path.join(tmpDir, `${toolName}_in_${randomId}${actualExt}`);
          tmpOutPath = path.join(tmpDir, `${toolName}_out_${randomId}${toolCfg.outputExt}`);

          await fs.writeFile(tmpInPath, inputBuffer);

          const args = [toolName, tmpInPath, tmpOutPath];
          if (extra) args.push(extra);

          await runLocalPythonScript(scriptPath, args, 120000);

          const outputBuffer = await fs.readFile(tmpOutPath);
          const originalName = filename.replace(/\.[^/.]+$/, '');
          const outFilename = `${originalName}${toolCfg.outputExt}`;

          res.statusCode = 200;
          res.setHeader('Content-Type', toolCfg.mimeType);
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(outFilename)}"`);
          res.end(outputBuffer);
        } catch (err: any) {
          console.error(`[VitePythonPlugin] Local Python conversion error for ${toolName}:`, err.message);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Local Python engine error: ${err.message}` }));
        } finally {
          if (tmpInPath) await fs.unlink(tmpInPath).catch(() => {});
          if (tmpOutPath) await fs.unlink(tmpOutPath).catch(() => {});
        }
      });
    },
  };
}
