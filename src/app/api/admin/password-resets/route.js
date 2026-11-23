import { NextResponse } from 'next/server';
import { getPasswordResetRequests } from '@/db';
import { verifySession } from '@/utils/session';

export async function GET() {
  try {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const allResets = await getPasswordResetRequests();
    const resets = (allResets || []).filter(r => r.status === 'PENDING');
    return NextResponse.json({ success: true, resets });
  } catch (error) {
    console.error('API password-resets GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
