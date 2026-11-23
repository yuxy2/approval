import { NextResponse } from 'next/server';
import { getPmUsers } from '@/db';

export async function GET() {
  try {
    const list = await getPmUsers();
    // Filter users who can act as PM (PM or Superadmin, excluding regular contractors)
    const filtered = list.filter((user) => {
      const role = (user.role || '').toLowerCase();
      return role === 'pm' || role === 'superadmin' || !role;
    });
    return NextResponse.json(filtered);
  } catch (error) {
    console.error('API pm-users GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
