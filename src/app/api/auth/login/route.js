import { NextResponse } from 'next/server';
import { getPmUserByEmail } from '@/db';
import { createSession } from '@/utils/session';
import { rateLimit } from '@/utils/rateLimit';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    // 1. IP Rate Limiting
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    const limitResult = rateLimit(ip, 5, 60000); // Max 5 login attempts per minute
    if (limitResult.limited) {
      return NextResponse.json(
        { success: false, error: `Too many login attempts. Please try again in ${limitResult.retryAfter} seconds.` },
        { status: 429, headers: { 'Retry-After': String(limitResult.retryAfter) } }
      );
    }

    // 2. JSON Body Parsing Safety
    let email, password;
    try {
      const body = await request.json();
      email = body.email;
      password = body.password;
    } catch (err) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // 3. Input validation & Type sanitization
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email and password must be valid strings' },
        { status: 400 }
      );
    }

    console.log(`[Login API] Login request received for email: "${email}"`);

    // 4. Fetch user
    const user = await getPmUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // 5. Handle pre-seeded users without passwords
    if (!user.password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Your account has not been set up with a password. Please register to initialize your password.',
        },
        { status: 400 }
      );
    }

    // 6. Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // 7. Check if active
    if (!user.active) {
      return NextResponse.json(
        { success: false, error: 'Your account is deactivated. Please contact support.' },
        { status: 403 }
      );
    }

    // 8. Create session
    await createSession(user.id.toString(), user.name, user.email, user.role || 'pm');

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'pm',
      },
    });
  } catch (error) {
    console.error('API auth/login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
