'use server';

import { revalidatePath } from 'next/cache';
import { createPlan, updatePlan, archivePlan, activatePlan } from '@/lib/firestore/admin-ops';
import { requireAdmin } from '@/lib/auth/server';
import { planSchema } from '@/lib/schemas';
import { z } from 'zod';

const payloadSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  priceUSD: z.number().nonnegative(),
  maxStudents: z.number().int().min(1),
  maxPlaylists: z.number().int().min(1),
  enableQuizGeneration: z.boolean(),
  enableProgressTracking: z.boolean(),
  enableAntiSkip: z.boolean(),
  enableCustomBranding: z.boolean(),
  enableAPIAccess: z.boolean(),
  enablePrioritySupport: z.boolean(),
  isActive: z.boolean(),
  sort: z.number().int(),
});

export async function createPlanAction(formData: FormData) {
  const admin = await requireAdmin();
  const raw = {
    name: formData.get('name'),
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    priceUSD: Number(formData.get('priceUSD')),
    maxStudents: Number(formData.get('maxStudents')),
    maxPlaylists: Number(formData.get('maxPlaylists')),
    enableQuizGeneration: formData.get('enableQuizGeneration') === 'true',
    enableProgressTracking: formData.get('enableProgressTracking') === 'true',
    enableAntiSkip: formData.get('enableAntiSkip') === 'true',
    enableCustomBranding: formData.get('enableCustomBranding') === 'true',
    enableAPIAccess: formData.get('enableAPIAccess') === 'true',
    enablePrioritySupport: formData.get('enablePrioritySupport') === 'true',
    isActive: formData.get('isActive') === 'true',
    sort: Number(formData.get('sort')),
  };
  const payload = payloadSchema.parse(raw);
  await createPlan(payload as any, admin.uid);
  revalidatePath('/admin/dashboard/plans');
}

export async function updatePlanAction(id: string, formData: FormData) {
  const admin = await requireAdmin();
  const raw = {
    name: formData.get('name') ?? undefined,
    title: formData.get('title') ?? undefined,
    description: formData.get('description') || undefined,
    priceUSD: formData.get('priceUSD') ? Number(formData.get('priceUSD')) : undefined,
    maxStudents: formData.get('maxStudents') ? Number(formData.get('maxStudents')) : undefined,
    maxPlaylists: formData.get('maxPlaylists') ? Number(formData.get('maxPlaylists')) : undefined,
    enableQuizGeneration: formData.get('enableQuizGeneration') ? formData.get('enableQuizGeneration') === 'true' : undefined,
    enableProgressTracking: formData.get('enableProgressTracking') ? formData.get('enableProgressTracking') === 'true' : undefined,
    enableAntiSkip: formData.get('enableAntiSkip') ? formData.get('enableAntiSkip') === 'true' : undefined,
    enableCustomBranding: formData.get('enableCustomBranding') ? formData.get('enableCustomBranding') === 'true' : undefined,
    enableAPIAccess: formData.get('enableAPIAccess') ? formData.get('enableAPIAccess') === 'true' : undefined,
    enablePrioritySupport: formData.get('enablePrioritySupport') ? formData.get('enablePrioritySupport') === 'true' : undefined,
    isActive: formData.get('isActive') ? formData.get('isActive') === 'true' : undefined,
    sort: formData.get('sort') ? Number(formData.get('sort')) : undefined,
  };
  const payload = planSchema.partial().parse(raw);
  await updatePlan(id, payload, admin.uid);
  revalidatePath('/admin/dashboard/plans');
}

export async function archivePlanAction(id: string) {
  const admin = await requireAdmin();
  await archivePlan(id, admin.uid);
  revalidatePath('/admin/dashboard/plans');
}

export async function activatePlanAction(id: string) {
  const admin = await requireAdmin();
  await activatePlan(id, admin.uid);
  revalidatePath('/admin/dashboard/plans');
}
