import { NextResponse } from 'next/server';
import { logoutSession } from '@/features/whatsapp/service';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await logoutSession();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Disconnect failed', code: err.code || 'UNKNOWN' },
      { status: err.status ?? 500 },
    );
  }
}
