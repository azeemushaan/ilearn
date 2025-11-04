'use server';

import { revalidatePath } from 'next/cache';
import { invalidateAiEngineCache } from '@/ai/genkit';
import { runAiConnectionTest } from '@/lib/ai/test-connection';
import { updateSystemAiSettings, updateSystemSettings, writeAudit } from '@/lib/firestore/admin-ops';
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
  invalidateAiEngineCache();
  revalidatePath('/admin/dashboard/settings');
  revalidatePath('/admin/dashboard/settings/prompts');
}

export type TestAiConnectionState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
  reply?: string;
};

export const initialTestAiConnectionState: TestAiConnectionState = Object.freeze({ status: 'idle' } satisfies TestAiConnectionState);

export async function testAiConnectionAction(
  _prevState: TestAiConnectionState,
  _formData: FormData,
): Promise<TestAiConnectionState> {
  const admin = await requireAdmin();

  try {
    const result = await runAiConnectionTest();
    await writeAudit({
      actorId: admin.uid,
      action: 'settings.ai.testConnection',
      target: { collection: 'settings', id: 'system.ai' },
      meta: {
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
      },
    });

    return {
      status: 'success',
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      reply: result.reply,
      message: `Connected to ${result.provider} (${result.model}) in ${result.latencyMs.toFixed(0)}ms.`,
    } satisfies TestAiConnectionState;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to test AI settings.';
    console.error('settings.ai.testConnectionFailed', {
      adminId: admin.uid,
      message,
      cause: error instanceof Error ? { name: error.name, stack: error.stack } : { value: error },
    });

    await writeAudit({
      actorId: admin.uid,
      action: 'settings.ai.testConnectionFailed',
      target: { collection: 'settings', id: 'system.ai' },
      meta: { error: message },
    });

    return {
      status: 'error',
      message,
    } satisfies TestAiConnectionState;
  }
}
