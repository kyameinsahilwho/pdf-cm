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
    const password = (formData.get('password') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!password.trim()) {
      return NextResponse.json({ error: 'Password parameter required' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const randomId = Math.random().toString(36).substring(2, 9);
    const tmpDir = os.tmpdir();
    tmpInPath = path.join(tmpDir, `protect_in_${randomId}.pdf`);
    tmpOutPath = path.join(tmpDir, `protect_out_${randomId}.pdf`);

    await fs.writeFile(tmpInPath, buffer);

    const scriptPath = path.join(process.cwd(), 'api', 'convert-office-pdf.py');
    const pythonExec = process.platform === 'win32' ? 'python' : 'python3';

    await execFileAsync(pythonExec, [scriptPath, 'protect-pdf', tmpInPath, tmpOutPath, password], {
      timeout: 60000,
      maxBuffer: 1024 * 1024 * 20,
    });

    const pdfBuffer = await fs.readFile(tmpOutPath);
    const originalName = file.name.replace(/\.[^/.]+$/, '');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="protected-${encodeURIComponent(originalName)}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error('[protect-pdf API] Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed protecting PDF' }, { status: 500 });
  } finally {
    if (tmpInPath) await fs.unlink(tmpInPath).catch(() => {});
    if (tmpOutPath) await fs.unlink(tmpOutPath).catch(() => {});
  }
}
