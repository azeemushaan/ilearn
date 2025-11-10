'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { updateSystemAiSettings, updateSystemSettings } from '@/lib/firestore/admin-ops';
import { requireAdmin } from '@/lib/auth/server';

export async function updateSettingsAction(formData: FormData) {
  const admin = await requireAdmin();
  const manualPaymentsEnabled = formData.get('manualPaymentsEnabled') === 'on';
  const supportEmail = String(formData.get('supportEmail'));
  const logoUrl = formData.get('logoUrl') ? String(formData.get('logoUrl')) : undefined;
  const primaryColor = formData.get('primaryColor') ? String(formData.get('primaryColor')) : undefined;
  const secondaryColor = formData.get('secondaryColor') ? String(formData.get('secondaryColor')) : undefined;
  
  // Handle file upload
  const logoFile = formData.get('logoFile') as File | null;
  let uploadedLogoUrl = logoUrl;
  
  if (logoFile && logoFile.size > 0) {
    try {
      // Upload file to Cloud Storage
      const { adminStorage } = await import('@/lib/firebase/admin');
      const bucket = adminStorage().bucket();
      const fileName = `logos/${Date.now()}-${logoFile.name}`;
      const file = bucket.file(fileName);
      
      const buffer = Buffer.from(await logoFile.arrayBuffer());
      await file.save(buffer, {
        metadata: {
          contentType: logoFile.type,
        }
      });
      
      // Make file publicly accessible
      await file.makePublic();
      uploadedLogoUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    } catch (error) {
      console.error('Failed to upload logo:', error);
      // Continue with existing logoUrl if upload fails
    }
  }
  
  await updateSystemSettings({
    manualPaymentsEnabled,
    supportEmail,
    branding: { 
      logoUrl: uploadedLogoUrl,
      primaryColor,
      secondaryColor,
    },
  }, admin.uid);
  revalidatePath('/admin/dashboard/settings');
  redirect('/admin/dashboard/settings?saved=general');
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
  redirect('/admin/dashboard/settings?saved=ai');
}

// AI Connection Test Types and Actions
export type TestAiConnectionState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
  reply?: string;
};

export async function testAiConnectionAction(
  prevState: TestAiConnectionState,
  formData: FormData
): Promise<TestAiConnectionState> {
  const admin = await requireAdmin();

  try {
    const { getCachedAiEngine } = await import('@/ai/genkit');
    const { instance, config, modelName } = await getCachedAiEngine();

    const startTime = Date.now();

    // Test with a simple prompt
    const { text } = await instance.generate({
      model: modelName,
      prompt: 'Respond with exactly one word: "success"',
      config: {
        temperature: 0,
        maxOutputTokens: 10,
      },
    });

    const latencyMs = Date.now() - startTime;
    const reply = text?.trim() || '';

    return {
      status: 'success',
      message: 'Connection successful',
      provider: config.provider,
      model: config.model,
      latencyMs,
      reply: reply.length > 0 ? reply : 'success',
    };
  } catch (error: any) {
    console.error('AI connection test failed:', error);
    return {
      status: 'error',
      message: error.message || 'Connection test failed',
    };
  }
}
