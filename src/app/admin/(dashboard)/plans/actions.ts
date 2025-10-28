'use server';

import { revalidatePath } from 'next/cache';
import { createPlan, updatePlan, archivePlan, activatePlan } from '@/lib/firestore/admin-ops';
import { requireAdmin } from '@/lib/auth/server';
import { planSchema } from '@/lib/schemas';

const payloadSchema = planSchema.omit({ createdAt: true, updatedAt: true, id: true }).extend({
  features: planSchema.shape.features,
});

export async function createPlanAction(formData: FormData) {
  const admin = await requireAdmin();
  const raw = {
    title: formData.get('title'),
    tier: formData.get('tier'),
    pricePKR: Number(formData.get('pricePKR')),
    priceUSD: formData.get('priceUSD') ? Number(formData.get('priceUSD')) : null,
    seatLimit: Number(formData.get('seatLimit')),
    features: JSON.parse(String(formData.get('features') ?? '[]')),
    isActive: formData.get('isActive') === 'true',
    sort: Number(formData.get('sort')),
  };
  const payload = payloadSchema.parse(raw);
  await createPlan(payload as any, admin.uid);
  revalidatePath('/admin/plans');
}

export async function updatePlanAction(id: string, formData: FormData) {
  const admin = await requireAdmin();
  const raw = {
    title: formData.get('title') ?? undefined,
    tier: formData.get('tier') ?? undefined,
    pricePKR: formData.get('pricePKR') ? Number(formData.get('pricePKR')) : undefined,
    priceUSD: formData.get('priceUSD') ? Number(formData.get('priceUSD')) : undefined,
    seatLimit: formData.get('seatLimit') ? Number(formData.get('seatLimit')) : undefined,
    features: formData.get('features') ? JSON.parse(String(formData.get('features'))) : undefined,
    isActive: formData.get('isActive') ? formData.get('isActive') === 'true' : undefined,
    sort: formData.get('sort') ? Number(formData.get('sort')) : undefined,
  };
  const payload = planSchema.partial().parse(raw);
  await updatePlan(id, payload, admin.uid);
  revalidatePath('/admin/plans');
}

export async function archivePlanAction(id: string) {
  const admin = await requireAdmin();
  await archivePlan(id, admin.uid);
  revalidatePath('/admin/plans');
}

export async function activatePlanAction(id: string) {
  const admin = await requireAdmin();
  await activatePlan(id, admin.uid);
  revalidatePath('/admin/plans');
}
