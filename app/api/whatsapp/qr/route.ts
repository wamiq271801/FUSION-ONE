import { NextResponse }         from 'next/server';
import { getQrSnapshot } from '@/features/whatsapp/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await getQrSnapshot();

  if (result.ok) {
    return NextResponse.json(result);
  }

  const status = result.code === 'WA_ALREADY_AUTHENTICATED' ? 409
               : result.code === 'WA_QR_REFRESH_IN_PROGRESS' ? 202
               : result.code === 'WA_QR_NOT_AVAILABLE' ? 503
               : 500;

  return NextResponse.json(
    { ok: false, code: result.code, message: result.message },
    { status },
  );
}
