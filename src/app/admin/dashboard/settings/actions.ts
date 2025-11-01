'use server';

import { revalidatePath } from 'next/cache';
import { getSystemSettings, updateSystemSettings } from '@/lib/firestore/admin-ops';
import { requireAdmin } from '@/lib/auth/server';

export async function updateSettingsAction(formData: FormData) {
  const admin = await requireAdmin();
  const manualPaymentsEnabled = formData.get('manualPaymentsEnabled') === 'on';
  const supportEmail = String(formData.get('supportEmail'));
  const logoUrl = formData.get('logoUrl') ? String(formData.get('logoUrl')) : undefined;
  await updateSystemSettings({
    manualPaymentsEnabled,
    supportEmail,
    branding: { logoUrl },
  }, admin.uid);
  revalidatePath('/admin/settings');
}
