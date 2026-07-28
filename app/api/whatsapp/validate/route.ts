import { NextRequest, NextResponse } from 'next/server';
import { whatsappManager } from '@/platform/whatsapp/manager';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) { const secret = process.env.WHATSAPP_INTERNAL_API_KEY; if (secret && request.headers.get('x-whatsapp-api-key') !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const { number } = await request.json(); if (typeof number !== 'string' || !/^\+?\d{8,15}$/.test(number.replace(/[\s()-]/g, ''))) return NextResponse.json({ valid: false, error: 'Enter a valid phone number with country code' }, { status: 400 }); return NextResponse.json({ valid: !!(await whatsappManager.lookupContact(number)) }); }
