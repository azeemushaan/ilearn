import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('__session');
  
  console.log('[MIDDLEWARE] Path:', request.nextUrl.pathname);
  console.log('[MIDDLEWARE] Session cookie exists:', !!sessionCookie);
  
  if (request.nextUrl.pathname.startsWith('/admin') && 
      !request.nextUrl.pathname.startsWith('/admin/login')) {
    if (!sessionCookie) {
      console.log('[MIDDLEWARE] No session, redirecting to login');
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
