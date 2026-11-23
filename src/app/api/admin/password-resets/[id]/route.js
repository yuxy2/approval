import { NextResponse } from 'next/server';
import { getPasswordResetRequests, updatePasswordResetRequest, updatePmUser, getPmUserByEmail } from '@/db';
import { verifySession } from '@/utils/session';
import { sendNotification } from '@/utils/emails';
import bcrypt from 'bcryptjs';

export async function POST(request, { params }) {
  try {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body; // 'approve' or 'reject'

    if (!action || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    const allResets = await getPasswordResetRequests();
    const resetReq = allResets.find(r => String(r.id) === String(id));

    if (!resetReq) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    if (resetReq.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'Request already processed' }, { status: 400 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    if (action === 'approve') {
      const { customPassword } = body;
      // Use custom password if provided, otherwise generate temporary password
      const tempPassword = (customPassword && customPassword.trim() !== '')
        ? customPassword
        : ('Temp' + Math.floor(1000 + Math.random() * 9000) + '!');
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Find user by user_id or email
      let user = null;
      if (resetReq.user_id) {
        user = await updatePmUser(resetReq.user_id, { password: hashedPassword });
      }
      if (!user && resetReq.email) {
        const existing = await getPmUserByEmail(resetReq.email);
        if (existing) {
          user = await updatePmUser(existing.id, { password: hashedPassword });
        }
      }

      if (!user) {
        return NextResponse.json({ success: false, error: 'Failed to update user password: User not found' }, { status: 500 });
      }

      // Mark request as APPROVED
      await updatePasswordResetRequest(resetReq.id, {
        status: 'APPROVED',
        processed_at: new Date(),
        processed_by: session.email
      });

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const username = resetReq.email.toLowerCase().split('@')[0];
      const customSiteId = `request-password-${username}-timestamp ${year}-${month}-${day} ${hours}:${minutes}`;

      // Send email to user
      try {
        await sendNotification({
          requestId: null,
          recipientEmail: resetReq.email,
          type: 'STATUS_UPDATE',
          subject: 'Permintaan Reset Kata Sandi Disetujui | Elevate Equity',
          body: `Halo ${resetReq.name || 'Pengguna'},\n\nPermintaan reset kata sandi Anda telah disetujui oleh Superadmin.\n\nKata sandi sementara Anda adalah:\n${tempPassword}\n\nSilakan masuk menggunakan kata sandi sementara ini dan segera perbarui melalui menu profil Anda.`,
          link: `${origin}/login`,
          customSiteId
        });
      } catch (err) {
        console.error('Failed to send approval email:', err);
      }

      return NextResponse.json({ success: true, message: 'Password reset approved.' });
    } else {
      // Mark request as REJECTED
      await updatePasswordResetRequest(resetReq.id, {
        status: 'REJECTED',
        processed_at: new Date(),
        processed_by: session.email
      });

      // Send email to user
      try {
        await sendNotification({
          requestId: null,
          recipientEmail: resetReq.email,
          type: 'STATUS_UPDATE',
          subject: 'Permintaan Reset Kata Sandi Ditolak | Elevate Equity',
          body: `Halo ${resetReq.name || 'Pengguna'},\n\nPermintaan reset kata sandi Anda telah ditolak oleh Superadmin. Jika ini adalah kesalahan, silakan hubungi manajer proyek Anda.`,
          link: `${origin}/login`
        });
      } catch (err) {
        console.error('Failed to send rejection email:', err);
      }

      return NextResponse.json({ success: true, message: 'Password reset declined.' });
    }
  } catch (error) {
    console.error('password-resets action error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
