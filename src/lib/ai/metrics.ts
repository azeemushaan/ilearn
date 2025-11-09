import { Timestamp } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase/admin';

export type AiUsageEvent = {
  flow: string;
  provider: string;
  model: string;
  durationMs: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  status: 'success' | 'error';
  videoId?: string | null;
  coachId?: string | null;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
};

export async function recordAiUsage(event: AiUsageEvent) {
  try {
    await adminFirestore().collection('ai_usage').add({
      ...event,
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    console.warn('[AI] Failed to record usage metrics', {
      error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
      event,
    });
  }
}
