import { NextResponse } from 'next/server';
import { deleteSession } from '@/utils/session';

export async function POST() {
  try {
    await deleteSession();
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('API auth/logout POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await deleteSession();
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('API auth/logout GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
