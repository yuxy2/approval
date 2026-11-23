import { NextResponse } from 'next/server';
import { verifySession } from '@/utils/session';

export async function GET() {
  try {
    const session = await verifySession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: true, user: session });
  } catch (error) {
    console.error('API auth/me GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
