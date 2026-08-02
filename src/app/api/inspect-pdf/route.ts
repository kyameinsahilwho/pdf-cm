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
    const pageNum = (formData.get('page') as string) || '1';

    if (!file) {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const randomId = Math.random().toString(36).substring(2, 9);
    const tmpDir = os.tmpdir();
    tmpInPath = path.join(tmpDir, `inspect_in_${randomId}.pdf`);
    tmpOutPath = path.join(tmpDir, `inspect_out_${randomId}.json`);

    await fs.writeFile(tmpInPath, buffer);

    const scriptPath = path.join(process.cwd(), 'api', 'convert-office-pdf.py');
    const pythonExec = process.platform === 'win32' ? 'python' : 'python3';

    await execFileAsync(pythonExec, [scriptPath, 'inspect-pdf', tmpInPath, tmpOutPath, pageNum], {
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 10,
    });

    const jsonStr = await fs.readFile(tmpOutPath, 'utf-8');
    const data = JSON.parse(jsonStr);

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[inspect-pdf API] Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed inspecting PDF elements' }, { status: 500 });
  } finally {
    if (tmpInPath) await fs.unlink(tmpInPath).catch(() => {});
    if (tmpOutPath) await fs.unlink(tmpOutPath).catch(() => {});
  }
}
