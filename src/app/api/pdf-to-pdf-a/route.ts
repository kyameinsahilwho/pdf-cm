import { NextRequest } from 'next/server';
import { handleConversionRequest } from '@/lib/server-python-runner';

export async function POST(req: NextRequest) {
  return handleConversionRequest(req, 'pdf-to-pdf-a', '.pdf', '.pdf', 'application/pdf');
}
