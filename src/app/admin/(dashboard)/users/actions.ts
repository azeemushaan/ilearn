'use server';

import { revalidatePath } from 'next/cache';
import { adminAuth, adminFirestore } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/auth/server';
import { setCustomClaims } from '@/lib/auth/claims';
import { userSchema } from '@/lib/schemas';

export async function setClaimsAction(uid: string, role: 'admin' | 'teacher' | 'student', coachId?: string | null) {
  const admin = await requireAdmin();
  await setCustomClaims(uid, role, coachId, admin.uid);
  revalidatePath('/admin/users');
}

export async function disableUserAction(uid: string) {
  const admin = await requireAdmin();
  await adminAuth().updateUser(uid, { disabled: true });
  await adminFirestore().collection('users').doc(uid).set({ status: 'disabled' }, { merge: true });
  revalidatePath('/admin/users');
}

export async function enableUserAction(uid: string) {
  const admin = await requireAdmin();
  await adminAuth().updateUser(uid, { disabled: false });
  await adminFirestore().collection('users').doc(uid).set({ status: 'active' }, { merge: true });
  revalidatePath('/admin/users');
}
