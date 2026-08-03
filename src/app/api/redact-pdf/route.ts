import { NextRequest } from 'next/server';
import { handleConversionRequest } from '@/lib/server-python-runner';

export async function POST(req: NextRequest) {
  return handleConversionRequest(req, 'redact-pdf', '.pdf', '.pdf', 'application/pdf');
}
