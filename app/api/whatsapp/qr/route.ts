import { NextRequest, NextResponse } from 'next/server';
import { whatsappManager } from '@/platform/whatsapp/manager';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) { const secret = process.env.WHATSAPP_INTERNAL_API_KEY; if (secret && request.headers.get('x-whatsapp-api-key') !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); await whatsappManager.start(); return NextResponse.json({ ...whatsappManager.getState(), pairing: whatsappManager.getQr() }); }
