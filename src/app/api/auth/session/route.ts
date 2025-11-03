import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    console.log('[SESSION] Received session request');

    if (!idToken) {
      console.error('[SESSION] Missing ID token');
      return NextResponse.json({ error: 'Missing ID token' }, { status: 400 });
    }

    console.log('[SESSION] Verifying ID token...');
    const decodedToken = await adminAuth().verifyIdToken(idToken);
    console.log('[SESSION] Token verified, UID:', decodedToken.uid, 'Role:', decodedToken.role);

    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    console.log('[SESSION] Creating session cookie...');
    
    // Add better error handling for session cookie creation
    try {
      const sessionCookie = await adminAuth().createSessionCookie(idToken, { expiresIn });
      console.log('[SESSION] Session cookie created, length:', sessionCookie.length);

      const response = NextResponse.json({
        success: true,
        uid: decodedToken.uid,
        role: decodedToken.role,
      });

      response.cookies.set({
        name: '__session',
        value: sessionCookie,
        maxAge: expiresIn / 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
      console.log('[SESSION] Cookie set in response');

      return response;
    } catch (cookieError: any) {
      console.error('[SESSION] Failed to create session cookie:', cookieError);
      // Check if it's a credential error
      if (cookieError?.code === 'auth/invalid-credential' || 
          cookieError?.message?.includes('Credential implementation') ||
          cookieError?.message?.includes('invalid_grant')) {
        return NextResponse.json({ 
          error: 'Authentication service unavailable. Please check server configuration.' 
        }, { status: 500 });
      }
      throw cookieError;
    }
  } catch (error: any) {
    console.error('[SESSION] Error:', error);
    // Return more specific error messages
    if (error?.code === 'auth/argument-error') {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('__session');
  return NextResponse.json({ success: true });
}