import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { runPythonScript } from '@/lib/server-python-runner';

export async function POST(req: NextRequest) {
  const serviceUrl = process.env.WORD_TO_PDF_SERVICE_URL || process.env.RENDER_CONVERSION_SERVICE_URL;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided in request' }, { status: 400 });
    }

    // If Render conversion service URL is set, delegate to dedicated microservice
    if (serviceUrl) {
      const targetUrl = serviceUrl.endsWith('/convert') || serviceUrl.endsWith('/api/word-to-pdf')
        ? serviceUrl
        : `${serviceUrl.replace(/\/+$/, '')}/convert`;

      const outboundFormData = new FormData();
      outboundFormData.append('file', file, file.name);

      const upstreamRes = await fetch(targetUrl, {
        method: 'POST',
        body: outboundFormData,
      });

      if (!upstreamRes.ok) {
        const errJson = await upstreamRes.json().catch(() => ({ error: 'Conversion service returned an error' }));
        return NextResponse.json(
          { error: errJson.error || 'Word to PDF conversion service failed' },
          { status: upstreamRes.status }
        );
      }

      const pdfArrayBuffer = await upstreamRes.arrayBuffer();
      const originalName = file.name.replace(/\.[^/.]+$/, '');

      return new NextResponse(pdfArrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(originalName)}.pdf"`,
        },
      });
    }

    // Fallback for local development if WORD_TO_PDF_SERVICE_URL is not configured
    let tmpInPath = '';
    let tmpOutPath = '';

    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const randomId = Math.random().toString(36).substring(2, 9);
      const tmpDir = os.tmpdir();
      tmpInPath = path.join(tmpDir, `word_to_pdf_in_${randomId}.docx`);
      tmpOutPath = path.join(tmpDir, `word_to_pdf_in_${randomId}.pdf`);

      await fs.writeFile(tmpInPath, buffer);

      const scriptPath = path.join(process.cwd(), 'api', 'convert-word-to-pdf.py');

      await runPythonScript(scriptPath, [tmpInPath, tmpOutPath], { timeout: 120000 });

      const pdfBuffer = await fs.readFile(tmpOutPath);
      const originalName = file.name.replace(/\.[^/.]+$/, '');

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(originalName)}.pdf"`,
        },
      });
    } finally {
      if (tmpInPath) await fs.unlink(tmpInPath).catch(() => {});
      if (tmpOutPath) await fs.unlink(tmpOutPath).catch(() => {});
    }
  } catch (err: any) {
    console.error('[word-to-pdf API] Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error converting document' }, { status: 500 });
  }
}
