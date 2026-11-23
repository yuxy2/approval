import { NextResponse } from 'next/server';
import { getPmUserByEmail, updatePmUser } from '@/db';
import { verifySession } from '@/utils/session';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const session = await verifySession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    const user = await getPmUserByEmail(session.email);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Verify current password if user has a password set
    if (user.password) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return NextResponse.json({ success: false, error: 'Incorrect current password' }, { status: 400 });
      }
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updated = await updatePmUser(user.id, { password: hashedPassword });
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Failed to update password' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('change-password route error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
