import { NextResponse } from 'next/server';
import { getPmUserByEmail, createPmUser } from '@/db';
import { createSession } from '@/utils/session';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  return NextResponse.json(
    { success: false, error: 'Registration is disabled. Please contact your administrator.' },
    { status: 403 }
  );
}
