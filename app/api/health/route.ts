import { NextResponse } from 'next/server';

/**
 * Health check endpoint used by the WinUI3 DesktopHost to detect when
 * the Next.js server is ready before navigating WebView2 to the app.
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: Date.now() });
}
