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
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  const headerToken = headers().get('x-firebase-auth');

  const token = sessionCookie || headerToken;
  if (!token) return null;

  const decoded = await adminAuth().verifySessionCookie(token, true).catch(async (err) => {
    if (err.code === 'auth/argument-error') {
      return adminAuth().verifyIdToken(token, true);
    }
    throw err;
  });

  return {
    uid: decoded.uid,
    email: decoded.email,
    role: decoded.role as string | undefined,
    coachId: decoded.coachId as string | undefined,
  };
}

export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user || user.role !== 'admin') {
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
