'use server';

import { revalidatePath } from 'next/cache';
import { disableCoach, enableCoach, upsertInvoice } from '@/lib/firestore/admin-ops';
import { requireAdmin } from '@/lib/auth/server';
import { invoiceSchema } from '@/lib/schemas';

export async function disableCoachAction(coachId: string) {
  const admin = await requireAdmin();
  await disableCoach(coachId, admin.uid);
  revalidatePath('/admin/coaches');
}

export async function enableCoachAction(coachId: string) {
  const admin = await requireAdmin();
  await enableCoach(coachId, admin.uid);
  revalidatePath('/admin/coaches');
}

export async function createInvoiceAction(formData: FormData) {
  const admin = await requireAdmin();
  const raw = {
    coachId: formData.get('coachId'),
    items: JSON.parse(String(formData.get('items') ?? '[]')),
    total: Number(formData.get('total')),
    currency: formData.get('currency'),
    status: formData.get('status'),
    dueAt: formData.get('dueAt') ? new Date(String(formData.get('dueAt'))) : null,
    createdAt: new Date(),
  };
  const parsed = invoiceSchema.parse(raw);
  await upsertInvoice(null, parsed as any, admin.uid);
  revalidatePath('/admin/invoices');
  revalidatePath('/admin/coaches');
}
