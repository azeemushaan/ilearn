'use server';

import { revalidatePath } from 'next/cache';
import { approvePayment, rejectPayment } from '@/lib/firestore/admin-ops';
import { requireAdmin } from '@/lib/auth/server';

export async function approvePaymentAction(id: string, notes?: string) {
  const admin = await requireAdmin();
  await approvePayment(id, admin.uid, notes);
  revalidatePath('/admin/payments');
  revalidatePath('/admin/subscriptions');
}

export async function rejectPaymentAction(id: string, notes: string) {
  const admin = await requireAdmin();
  await rejectPayment(id, admin.uid, notes);
  revalidatePath('/admin/payments');
}
