import { NextRequest, NextResponse } from 'next/server';
import { whatsappManager } from '@/platform/whatsapp/manager';
export const runtime = 'nodejs';
const allowed = (request: NextRequest) => !process.env.WHATSAPP_INTERNAL_API_KEY || request.headers.get('x-whatsapp-api-key') === process.env.WHATSAPP_INTERNAL_API_KEY;
export async function GET(request: NextRequest) { if (!allowed(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); return NextResponse.json(whatsappManager.getDiagnostics()); }
