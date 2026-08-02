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
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided in request' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const randomId = Math.random().toString(36).substring(2, 9);
    const tmpDir = os.tmpdir();
    tmpInPath = path.join(tmpDir, `word_to_pdf_in_${randomId}.docx`);
    tmpOutPath = path.join(tmpDir, `word_to_pdf_in_${randomId}.pdf`);

    await fs.writeFile(tmpInPath, buffer);

    const scriptPath = path.join(process.cwd(), 'api', 'convert-word-to-pdf.py');

    // Execute Python script
    const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
    
    try {
      await execFileAsync(pythonExecutable, [scriptPath, tmpInPath, tmpOutPath], {
        timeout: 60000,
        maxBuffer: 1024 * 1024 * 10,
      });
    } catch (execErr: any) {
      console.error('[word-to-pdf API] Python process execution error:', execErr);
      return NextResponse.json(
        { error: 'Python conversion process failed', details: execErr?.stderr || execErr?.message },
        { status: 500 }
      );
    }

    const pdfBuffer = await fs.readFile(tmpOutPath);
    const originalName = file.name.replace(/\.[^/.]+$/, '');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(originalName)}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error('[word-to-pdf API] Error handling request:', err);
    return NextResponse.json({ error: err?.message || 'Server error converting document' }, { status: 500 });
  } finally {
    if (tmpInPath) {
      await fs.unlink(tmpInPath).catch(() => {});
    }
    if (tmpOutPath) {
      await fs.unlink(tmpOutPath).catch(() => {});
    }
  }
}
