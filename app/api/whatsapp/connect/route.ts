import { NextResponse } from 'next/server';
import { restartSession } from '@/features/whatsapp/service';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await restartSession();
    return NextResponse.json({ ok: true, message: 'Restart initiated' });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Connect failed', code: err.code || 'UNKNOWN' },
      { status: err.status ?? 500 },
    );
  }
}
