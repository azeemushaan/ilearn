'use server';

import { revalidatePath } from 'next/cache';
import { updateSystemAiSettings, updateSystemSettings } from '@/lib/firestore/admin-ops';
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
  revalidatePath('/admin/dashboard/settings');
}

export async function updateAiSettingsAction(formData: FormData) {
  const admin = await requireAdmin();

  const provider = formData.get('provider');
  const model = formData.get('model');
  const apiKey = formData.get('apiKey');
  const activePromptId = formData.get('activePromptId');

  const updates: Record<string, unknown> = {};

  if (typeof provider === 'string' && provider.trim().length > 0) {
    updates.provider = provider.trim();
  }

  if (typeof model === 'string' && model.trim().length > 0) {
    updates.model = model.trim();
  }

  if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
    updates.apiKey = apiKey.trim();
  }

  if (typeof activePromptId === 'string') {
    updates.activePromptId = activePromptId.length > 0 ? activePromptId : null;
  }

  await updateSystemAiSettings(updates, admin.uid);
  revalidatePath('/admin/dashboard/settings');
  revalidatePath('/admin/dashboard/settings/prompts');
}
