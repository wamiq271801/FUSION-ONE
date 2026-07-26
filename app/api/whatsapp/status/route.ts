import { NextResponse }          from 'next/server';
import { getStatusFromBackend } from '@/features/whatsapp/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = await getStatusFromBackend();
  return NextResponse.json(status);
}
