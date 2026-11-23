import { NextResponse } from 'next/server';
import { decrypt } from '@/utils/session';
import { cookies } from 'next/headers';

// Define route categories
const protectedRoutes = ['/', '/profile', '/manage-users', '/new', '/sheets'];
const authRoutes = ['/login', '/register'];

export async function proxy(request) {
  const path = request.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.includes(path);
  const isAuthRoute = authRoutes.includes(path);

  // 1. Force redirect /register to /login
  if (path === '/register') {
    const url = new URL('/login', request.nextUrl);
    return NextResponse.redirect(url);
  }

  // Decrypt session
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  const session = sessionCookie ? await decrypt(sessionCookie) : null;

  // 2. If route is protected and user has no valid session, redirect to /login
  if (isProtectedRoute && !session?.userId) {
    const url = new URL('/login', request.nextUrl);
    return NextResponse.redirect(url);
  }

  // 3. If route is login/register and user is already logged in, redirect to /
  if (isAuthRoute && session?.userId) {
    const url = new URL('/', request.nextUrl);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
