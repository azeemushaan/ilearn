'use server';

import { revalidatePath } from 'next/cache';
import { adminAuth, adminFirestore } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/auth/server';
import { setCustomClaims } from '@/lib/auth/claims';
import { userSchema } from '@/lib/schemas';

export async function setClaimsAction(uid: string, role: 'admin' | 'coach' | 'student', coachId?: string | null) {
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

export async function deleteUserAction(uid: string) {
  const admin = await requireAdmin();
  
  // Get user data before deletion for audit
  const userDoc = await adminFirestore().collection('users').doc(uid).get();
  const userData = userDoc.data();
  
  // Delete from Firebase Auth
  try {
    await adminAuth().deleteUser(uid);
  } catch (error: any) {
    console.warn(`Could not delete auth account for ${uid}:`, error.message);
  }
  
  // Delete from Firestore users collection
  await adminFirestore().collection('users').doc(uid).delete();
  
  // Delete all related student data
  const firestore = adminFirestore();
  const batch = firestore.batch();
  
  // Delete progress records
  const progressSnap = await firestore.collection('progress').where('studentId', '==', uid).get();
  progressSnap.docs.forEach(doc => batch.delete(doc.ref));
  
  // Delete attempts
  const attemptsSnap = await firestore.collection('attempts').where('studentId', '==', uid).get();
  attemptsSnap.docs.forEach(doc => batch.delete(doc.ref));
  
  // Delete invitations
  const invitationsSnap = await firestore.collection('invitations').where('email', '==', userData?.profile?.email).get();
  invitationsSnap.docs.forEach(doc => batch.delete(doc.ref));
  
  await batch.commit();
  
  revalidatePath('/admin/users');
  revalidatePath('/admin/coaches');
}
