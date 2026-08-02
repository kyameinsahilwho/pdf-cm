import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  let tmpInPath = '';
  let tmpOutPath = '';

  try {
    const bodyText = await req.text();
    if (!bodyText || !bodyText.trim()) {
      return NextResponse.json({ error: 'No HTML content provided' }, { status: 400 });
    }

    const randomId = Math.random().toString(36).substring(2, 9);
    const tmpDir = os.tmpdir();
    tmpInPath = path.join(tmpDir, `html_pdf_in_${randomId}.html`);
    tmpOutPath = path.join(tmpDir, `html_pdf_out_${randomId}.pdf`);

    await fs.writeFile(tmpInPath, bodyText, 'utf-8');

    const scriptPath = path.join(process.cwd(), 'api', 'convert-office-pdf.py');
    const pythonExec = process.platform === 'win32' ? 'python' : 'python3';

    await execFileAsync(pythonExec, [scriptPath, 'html-to-pdf', tmpInPath, tmpOutPath], {
      timeout: 60000,
      maxBuffer: 1024 * 1024 * 20,
    });

    const pdfBuffer = await fs.readFile(tmpOutPath);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="converted-webpage.pdf"',
      },
    });
  } catch (err: any) {
    console.error('[html-to-pdf API] Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed converting HTML to PDF' }, { status: 500 });
  } finally {
    if (tmpInPath) await fs.unlink(tmpInPath).catch(() => {});
    if (tmpOutPath) await fs.unlink(tmpOutPath).catch(() => {});
  }
}
