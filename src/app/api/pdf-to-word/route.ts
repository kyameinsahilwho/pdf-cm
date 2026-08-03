import { NextRequest } from 'next/server';
import { handleConversionRequest } from '@/lib/server-python-runner';

export async function POST(req: NextRequest) {
  return handleConversionRequest(
    req,
    'pdf-to-word',
    '.pdf',
    '.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}
