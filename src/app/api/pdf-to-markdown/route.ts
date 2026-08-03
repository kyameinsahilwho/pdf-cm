import { NextRequest } from 'next/server';
import { handleConversionRequest } from '@/lib/server-python-runner';

export async function POST(req: NextRequest) {
  return handleConversionRequest(req, 'pdf-to-markdown', '.pdf', '.md', 'text/markdown');
}
