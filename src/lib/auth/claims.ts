import { adminAuth, adminFirestore } from '@/lib/firebase/admin';
import { writeAudit } from '@/lib/firestore/admin-ops';

export async function setCustomClaims(uid: string, role: 'admin' | 'teacher' | 'student', coachId?: string | null, actorId?: string) {
  await adminAuth().setCustomUserClaims(uid, { role, coachId: coachId ?? null });
  if (coachId) {
    await adminFirestore().collection('users').doc(uid).set({ coachId }, { merge: true });
  }
  if (actorId) {
    await writeAudit({
      actorId,
      action: 'user.claims.update',
      target: { collection: 'users', id: uid },
      meta: { role, coachId },
    });
  }
}
