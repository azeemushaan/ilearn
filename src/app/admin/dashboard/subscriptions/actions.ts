'use server';

import { revalidatePath } from 'next/cache';
import { updateSubscription, createSubscription, cancelSubscription } from '@/lib/firestore/admin-ops';
import { requireAdmin } from '@/lib/auth/server';
import { subscriptionSchema } from '@/lib/schemas';

export async function createSubscriptionAction(formData: FormData) {
  const admin = await requireAdmin();
  const raw = {
    coachId: formData.get('coachId'),
    planId: formData.get('planId'),
    tier: formData.get('tier'),
    seatLimit: Number(formData.get('seatLimit')),
    status: formData.get('status') || 'active',
    currentPeriodEnd: formData.get('currentPeriodEnd') ? new Date(String(formData.get('currentPeriodEnd'))) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  };
  const payload = subscriptionSchema.omit({ createdAt: true, updatedAt: true }).parse(raw);
  await createSubscription(payload as any, admin.uid);
  revalidatePath('/admin/subscriptions');
  revalidatePath('/admin/coaches');
}

export async function updateSubscriptionAction(id: string, formData: FormData) {
  const admin = await requireAdmin();
  const raw = {
    planId: formData.get('planId') ?? undefined,
    tier: formData.get('tier') ?? undefined,
    seatLimit: formData.get('seatLimit') ? Number(formData.get('seatLimit')) : undefined,
    status: formData.get('status') ?? undefined,
    currentPeriodEnd: formData.get('currentPeriodEnd') ? new Date(String(formData.get('currentPeriodEnd'))) : undefined,
  };
  const payload = subscriptionSchema.partial().parse(raw);
  await updateSubscription(id, payload, admin.uid);
  revalidatePath('/admin/subscriptions');
  revalidatePath('/admin/coaches');
}

export async function cancelSubscriptionAction(id: string) {
  const admin = await requireAdmin();
  await cancelSubscription(id, admin.uid);
  revalidatePath('/admin/subscriptions');
  revalidatePath('/admin/coaches');
}
