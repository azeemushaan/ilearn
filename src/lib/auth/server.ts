import { cookies, headers } from 'next/headers';
import { adminAuth } from '@/lib/firebase/admin';

export type AuthenticatedUser = {
  uid: string;
  email?: string;
  role?: string;
  coachId?: string;
};

const SESSION_COOKIE = '__session';

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
    const headersList = await headers();
    const headerToken = headersList.get('x-firebase-auth');

    const token = sessionCookie || headerToken;
    console.log('[AUTH] Token exists:', !!token);
    
    if (!token) {
      console.log('[AUTH] No token found');
      return null;
    }

    console.log('[AUTH] Verifying token...');
    const decoded = await adminAuth().verifySessionCookie(token, true).catch(async (err) => {
      console.log('[AUTH] Session cookie verification failed, trying ID token:', err.code);
      if (err.code === 'auth/argument-error') {
        return adminAuth().verifyIdToken(token, true);
      }
      throw err;
    });

    console.log('[AUTH] Token verified. UID:', decoded.uid, 'Role:', decoded.role);
    return {
      uid: decoded.uid,
      email: decoded.email,
      role: decoded.role as string | undefined,
      coachId: decoded.coachId as string | undefined,
    };
  } catch (error) {
    console.error('[AUTH] Error in getAuthenticatedUser:', error);
    return null;
  }
}

export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  console.log('[AUTH] requireAdmin - User:', user);
  
  if (!user || user.role !== 'admin') {
    console.error('[AUTH] Access denied. User role:', user?.role);
    throw new Error('Forbidden');
  }
  
  return user;
}

export async function requireRole(roles: Array<'admin' | 'teacher' | 'student'>): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user || !user.role || !roles.includes(user.role as any)) {
    throw new Error('Forbidden');
  }
  return user;
}
