'use server';

import { revalidatePath } from 'next/cache';
import { updateSubscription } from '@/lib/firestore/admin-ops';
import { requireAdmin } from '@/lib/auth/server';
import { subscriptionSchema } from '@/lib/schemas';

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
