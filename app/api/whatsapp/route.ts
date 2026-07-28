import { NextRequest, NextResponse } from 'next/server';
import { whatsappManager } from '@/platform/whatsapp/manager';

export const runtime = 'nodejs';

function authorized(request: NextRequest) { const secret = process.env.WHATSAPP_INTERNAL_API_KEY; return !secret || request.headers.get('x-whatsapp-api-key') === secret; }
export async function GET(request: NextRequest) { if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); return NextResponse.json(whatsappManager.getState()); }
export async function POST(request: NextRequest) { if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const body = await request.json().catch(() => ({})); if (body.action === 'restart') await whatsappManager.shutdown(); await whatsappManager.start(); return NextResponse.json(whatsappManager.getState()); }
export async function DELETE(request: NextRequest) { if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); await whatsappManager.logout(); return NextResponse.json(whatsappManager.getState()); }
