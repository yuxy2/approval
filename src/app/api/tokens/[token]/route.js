import { NextResponse } from 'next/server';
import { getRequestByToken } from '@/db';
import { verifySession } from '@/utils/session';
import { sendErrorTelegramNotification } from '@/utils/telegram';

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    const res = await getRequestByToken(token);
    
    if (!res) {
      return NextResponse.json({ success: false, error: 'Token not found or expired' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      request: res.request,
      role: res.role,
      notificationType: res.notificationType,
      expiresAt: res.expires_at
    });
  } catch (error) {
    console.error('API tokens GET error:', error);
    let session = null;
    let siteId = null;
    try {
      session = await verifySession();
    } catch (_) {}
    try {
      const { token } = await params;
      siteId = `Token: ${token}`;
    } catch (_) {}
    try {
      await sendErrorTelegramNotification(error, { siteId, session, path: request.nextUrl.pathname });
    } catch (tgErr) {
      console.error('Failed to send error notification to Telegram:', tgErr);
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
