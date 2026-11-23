import { NextResponse } from 'next/server';
import { verifySession } from '@/utils/session';
import { getAllPmUsers, createPmUser, getPmUserByEmail, getPasswordResetRequests } from '@/db';
import bcrypt from 'bcryptjs';

// GET: List all users (Requires superadmin)
export async function GET() {
  try {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Access denied' },
        { status: 403 }
      );
    }

    const users = await getAllPmUsers();
    const pendingResets = await getPasswordResetRequests();

    // Exclude passwords from return data, and attach pending reset flag
    const safeUsers = users.map(({ password, ...u }) => {
      const hasPendingReset = pendingResets.some(
        r => r.email.toLowerCase() === u.email.toLowerCase() && r.status === 'PENDING'
      );
      return {
        ...u,
        has_pending_reset: hasPendingReset
      };
    });

    return NextResponse.json({ success: true, users: safeUsers });
  } catch (error) {
    console.error('API admin/users GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Add user (Requires superadmin)
export async function POST(request) {
  try {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Access denied' },
        { status: 403 }
      );
    }

    // JSON Body Parsing Safety
    let name, email, password, role;
    try {
      const body = await request.json();
      name = body.name;
      email = body.email;
      password = body.password;
      role = body.role;
    } catch (err) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Validation & Type sanitization
    if (!name || !email || !password || !role ||
        typeof name !== 'string' || typeof email !== 'string' ||
        typeof password !== 'string' || typeof role !== 'string') {
      return NextResponse.json(
        { success: false, error: 'All fields (name, email, password, role) must be valid strings' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await getPmUserByEmail(email);
    if (existing && existing.password) {
      return NextResponse.json(
        { success: false, error: 'A user with this email address already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await createPmUser({
      name,
      email,
      password: hashedPassword,
      role
    });

    if (!newUser) {
      return NextResponse.json(
        { success: false, error: 'Failed to create user account' },
        { status: 500 }
      );
    }

    // Exclude password from response
    const { password: _, ...safeUser } = newUser;

    return NextResponse.json(
      { success: true, user: safeUser },
      { status: 201 }
    );
  } catch (error) {
    console.error('API admin/users POST error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
