import { NextResponse } from 'next/server';
import { getPmUserByEmail, getAllPmUsers, getPasswordResetRequests, createPasswordResetRequest } from '@/db';
import { sendNotification } from '@/utils/emails';
import { rateLimit } from '@/utils/rateLimit';
import crypto from 'crypto';

export async function POST(request) {
  try {
    // 1. IP Rate Limiting
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    const limitResult = rateLimit(ip, 5, 60000); // Max 5 reset requests per minute
    if (limitResult.limited) {
      return NextResponse.json(
        { success: false, error: `Too many password reset attempts. Please try again in ${limitResult.retryAfter} seconds.` },
        { status: 429, headers: { 'Retry-After': String(limitResult.retryAfter) } }
      );
    }

    // 2. JSON Body Parsing Safety
    let email;
    try {
      const body = await request.json();
      email = body.email;
    } catch (err) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // 3. Input validation & Type sanitization
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email address must be a valid string' },
        { status: 400 }
      );
    }

    const user = await getPmUserByEmail(email);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Email address not found' }, { status: 404 });
    }

    if (!user.active) {
      return NextResponse.json({ success: false, error: 'Account is deactivated' }, { status: 403 });
    }

    // Check if there is already a PENDING request for this user
    const pendingResets = await getPasswordResetRequests();
    const existing = pendingResets.find(
      r => r.email.toLowerCase() === email.toLowerCase() && r.status === 'PENDING'
    );
    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Reset request already submitted. Please wait for Superadmin approval.'
      });
    }

    await createPasswordResetRequest({
      email: user.email.toLowerCase(),
      name: user.name,
      user_id: user.id,
      role: user.role
    });

    // Send email to Superadmins
    const allUsers = await getAllPmUsers();
    const superadmins = allUsers.filter(u => u.role === 'superadmin' && u.active);
    
    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const username = user.email.toLowerCase().split('@')[0];
    const customSiteId = `request-password-${username}-timestamp ${year}-${month}-${day} ${hours}:${minutes}`;

    for (const admin of superadmins) {
      try {
        await sendNotification({
          requestId: null,
          recipientEmail: admin.email,
          type: 'STATUS_UPDATE',
          subject: `[Password Reset Request] ${user.name} (${user.role})`,
          body: `Hi ${admin.name},\n\n${user.name} (${user.email}) has requested a password reset for their account.\n\nPlease log in to the Elevate Equity Form Approval Portal to approve or decline this request.`,
          link: `${origin}/manage-users`,
          customSiteId
        });
      } catch (err) {
        console.error(`Failed to send reset email to admin ${admin.email}:`, err);
      }
    }

    return NextResponse.json({ success: true, message: 'Password reset request submitted successfully.' });
  } catch (error) {
    console.error('forgot-password route error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
