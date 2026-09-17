import { NextResponse } from 'next/server';
import { getBlob } from '@/lib/cache/blob';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const fresh = new URL(request.url).searchParams.get('fresh') === '1';
  const blob = await getBlob(fresh);
  return NextResponse.json(blob, { headers: { 'Cache-Control': 'private, no-store' } });
}
