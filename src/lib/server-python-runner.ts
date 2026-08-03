import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execFileAsync = promisify(execFile);

/**
 * Executes a Python script reliably across Windows, Mac, and Linux environments.
 * Tries `python`, `py`, and `python3` in order if command fails with ENOENT.
 */
export async function runPythonScript(
  scriptPath: string,
  args: string[],
  options: { timeout?: number; maxBuffer?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  const executables = process.platform === 'win32'
    ? ['python', 'py', 'python3']
    : ['python3', 'python'];

  let lastError: any = null;

  for (const pyExec of executables) {
    try {
      const res = await execFileAsync(pyExec, [scriptPath, ...args], {
        timeout: options.timeout || 120000,
        maxBuffer: options.maxBuffer || 1024 * 1024 * 50,
      });
      return res;
    } catch (err: any) {
      lastError = err;
      if (err.code === 'ENOENT') {
        continue;
      }
      const stderr = err.stderr || err.message || 'Python execution failed';
      throw new Error(`Python execution error (${pyExec}): ${stderr}`);
    }
  }

  throw new Error(
    `Failed to locate Python executable (${executables.join(', ')}). Error: ${lastError?.message || lastError}`
  );
}

/**
 * Helper to process document conversion requests.
 * Proxies to Render Python microservice if PDF_ENGINE_SERVICE_URL is set,
 * or executes consolidated api/index.py locally.
 */
export async function handleConversionRequest(
  req: NextRequest,
  toolName: string,
  defaultInputExt: string,
  outputExt: string,
  mimeType: string
): Promise<NextResponse> {
  const rawServiceUrl =
    process.env.PDF_ENGINE_SERVICE_URL ||
    process.env.WORD_TO_PDF_SERVICE_URL ||
    process.env.RENDER_CONVERSION_SERVICE_URL;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const redactions = formData.get('redactions') as string | null;
    const edits = formData.get('edits') as string | null;
    const page = formData.get('page') as string | null;
    const password = formData.get('password') as string | null;
    const extraField = formData.get('extra') as string | null;

    const extra = redactions || edits || page || password || extraField || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided in request' }, { status: 400 });
    }

    // 1. Forward request to Render container microservice if URL configured
    if (rawServiceUrl && rawServiceUrl.trim()) {
      let baseUrl = rawServiceUrl.trim().replace(/\/+$/, '');
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      const targetUrl = `${baseUrl}/convert/${toolName}`;

      const outboundFormData = new FormData();
      outboundFormData.append('file', file, file.name);
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
        const errJson = await upstreamRes.json().catch(() => ({ error: 'Conversion service error' }));
        return NextResponse.json(
          { error: errJson.error || `${toolName} conversion failed` },
          { status: upstreamRes.status }
        );
      }

      const fileBuffer = await upstreamRes.arrayBuffer();
      const originalName = file.name.replace(/\.[^/.]+$/, '');
      const outFilename = `${originalName}${outputExt}`;

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(outFilename)}"`,
        },
      });
    }

    // 2. Fallback to local python script runner using consolidated api/index.py
    let tmpInPath = '';
    let tmpOutPath = '';

    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const randomId = Math.random().toString(36).substring(2, 9);
      const tmpDir = os.tmpdir();
      const actualExt = path.extname(file.name) || defaultInputExt;
      tmpInPath = path.join(tmpDir, `${toolName}_in_${randomId}${actualExt}`);
      tmpOutPath = path.join(tmpDir, `${toolName}_out_${randomId}${outputExt}`);

      await fs.writeFile(tmpInPath, buffer);

      const scriptPath = path.join(process.cwd(), 'api', 'index.py');
      const args = [toolName, tmpInPath, tmpOutPath];
      if (extra) args.push(extra);

      await runPythonScript(scriptPath, args, { timeout: 120000 });

      const outputBuffer = await fs.readFile(tmpOutPath);
      const originalName = file.name.replace(/\.[^/.]+$/, '');
      const outFilename = `${originalName}${outputExt}`;

      return new NextResponse(outputBuffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(outFilename)}"`,
        },
      });
    } finally {
      if (tmpInPath) await fs.unlink(tmpInPath).catch(() => {});
      if (tmpOutPath) await fs.unlink(tmpOutPath).catch(() => {});
    }
  } catch (err: any) {
    console.error(`[${toolName} API] Error:`, err);
    return NextResponse.json({ error: err?.message || 'Server error processing document' }, { status: 500 });
  }
}
