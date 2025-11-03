'use server';

import { revalidatePath } from 'next/cache';
import { disableCoach, enableCoach, upsertInvoice, createCoach, updateCoach, deleteCoach } from '@/lib/firestore/admin-ops';
import { requireAdmin } from '@/lib/auth/server';
import { invoiceSchema, coachSchema } from '@/lib/schemas';

export async function createCoachAction(formData: FormData) {
  const admin = await requireAdmin();
  const raw = {
    displayName: formData.get('displayName'),
    email: formData.get('email'),
    phone: formData.get('phone') || null,
    brand: {
      name: formData.get('brandName'),
      logoUrl: formData.get('logoUrl') || null,
      color: formData.get('color') || null,
    },
    plan: {
      tier: formData.get('tier') || 'free',
      seats: Number(formData.get('seats') || 0),
      expiresAt: formData.get('expiresAt') ? new Date(String(formData.get('expiresAt'))) : null,
    },
    settings: {
      locale: (formData.get('locale') as 'en' | 'ur') || 'en',
      lowBandwidthDefault: formData.get('lowBandwidthDefault') === 'true',
    },
  };
  const parsed = coachSchema.omit({ createdAt: true, updatedAt: true }).parse(raw);
  await createCoach(parsed as any, admin.uid);
  revalidatePath('/admin/coaches');
}

export async function updateCoachAction(id: string, formData: FormData) {
  const admin = await requireAdmin();
  const raw = {
    displayName: formData.get('displayName') || undefined,
    email: formData.get('email') || undefined,
    phone: formData.get('phone') || undefined,
  };
  const payload = coachSchema.partial().parse(raw);
  await updateCoach(id, payload, admin.uid);
  revalidatePath('/admin/coaches');
}

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

export async function deleteCoachAction(coachId: string) {
  const admin = await requireAdmin();
  await deleteCoach(coachId, admin.uid);
  revalidatePath('/admin/coaches');
  revalidatePath('/admin/users');
  revalidatePath('/admin/subscriptions');
  revalidatePath('/admin/invoices');
  revalidatePath('/admin/payments');
}
