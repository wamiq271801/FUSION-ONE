import { NextRequest, NextResponse } from 'next/server';
import { whatsappManager } from '@/lib/whatsapp/manager';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) { const secret = process.env.WHATSAPP_INTERNAL_API_KEY; if (secret && request.headers.get('x-whatsapp-api-key') !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const id = request.nextUrl.searchParams.get('id'); if (id) return NextResponse.json({ contact: await whatsappManager.lookupContact(id) }); return NextResponse.json({ contacts: whatsappManager.getContacts() }); }
