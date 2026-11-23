import { NextResponse } from 'next/server';
import { getEmails, clearEmails } from '@/db';

export async function GET() {
  try {
    const emails = await getEmails();
    return NextResponse.json(emails);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearEmails();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
