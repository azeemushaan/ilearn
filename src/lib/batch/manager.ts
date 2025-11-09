/**
 * Batch Processing Manager
 * Handles batch job creation, execution, and queue management with concurrency control
 */

import { adminFirestore } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { reserveCredits, consumeCredits, refundCredits, releaseReservedCredits, estimateCredits } from '@/lib/credits/manager';

export interface BatchJobConfig {
  type: 'captions' | 'segment' | 'mcq' | 'manifest' | 'full';
  videoIds: string[];
  coachId: string;
  createdBy: string;
  config?: {
    captionSource?: 'oauth' | 'ai';
    captionLanguage?: string;
    mcqLanguage?: string;
    engine?: 'google' | 'whisper';
  };
}

export interface ConcurrencyLimits {
  perCoach: number;
  global: number;
}

/**
 * Get concurrency limits from plan or system settings
 */
export async function getConcurrencyLimits(coachId: string): Promise<ConcurrencyLimits> {
  const db = adminFirestore();
  
  // Get coach's plan
  const coachDoc = await db.collection('coaches').doc(coachId).get();
  if (!coachDoc.exists) {
    return { perCoach: 2, global: 10 }; // Defaults
  }

  const coachData = coachDoc.data()!;
  const planId = coachData.plan?.planId;

  if (planId) {
    const planDoc = await db.collection('plans').doc(planId).get();
    if (planDoc.exists) {
      const planData = planDoc.data()!;
      return {
        perCoach: planData.concurrency?.perCoach || 2,
        global: planData.concurrency?.global || 10,
      };
    }
  }

  // Fallback to system settings
  const settingsDoc = await db.collection('settings').doc('system').get();
  if (settingsDoc.exists) {
    const settingsData = settingsDoc.data()!;
    return {
      perCoach: settingsData.processing?.concurrency?.perCoach || 2,
      global: settingsData.processing?.concurrency?.global || 10,
    };
  }

  return { perCoach: 2, global: 10 };
}

/**
 * Check if coach can start a new job (respects concurrency limits)
 */
export async function canStartJob(coachId: string): Promise<{ allowed: boolean; reason?: string }> {
  const db = adminFirestore();
  const limits = await getConcurrencyLimits(coachId);

  // Check per-coach limit
  const coachJobsSnapshot = await db.collection('batch_jobs')
    .where('coachId', '==', coachId)
    .where('status', 'in', ['queued', 'running'])
    .get();

  if (coachJobsSnapshot.size >= limits.perCoach) {
    return {
      allowed: false,
      reason: `Coach concurrency limit reached (${limits.perCoach}). Wait for current jobs to complete.`,
    };
  }

  // Check global limit
  const globalJobsSnapshot = await db.collection('batch_jobs')
    .where('status', 'in', ['queued', 'running'])
    .get();

  if (globalJobsSnapshot.size >= limits.global) {
    return {
      allowed: false,
      reason: `System concurrency limit reached (${limits.global}). Please try again later.`,
    };
  }

  return { allowed: true };
}

/**
 * Create a batch job
 */
export async function createBatchJob(config: BatchJobConfig): Promise<string> {
  const db = adminFirestore();

  // Check concurrency limits
  const canStart = await canStartJob(config.coachId);
  if (!canStart.allowed) {
    throw new Error(canStart.reason);
  }

  // Estimate credits if using AI transcription
  let creditsToReserve = 0;
  if (config.config?.captionSource === 'ai') {
    // Fetch video durations
    const videoRefs = config.videoIds.map(id => db.collection('videos').doc(id));
    const videoDocs = await Promise.all(videoRefs.map(ref => ref.get()));
    
    creditsToReserve = videoDocs.reduce((sum, doc) => {
      if (doc.exists) {
        const duration = doc.data()!.duration || 0;
        return sum + estimateCredits(duration);
      }
      return sum;
    }, 0);

    // Reserve credits
    if (creditsToReserve > 0) {
      await reserveCredits(config.coachId, creditsToReserve, config.createdBy, {
        reason: 'Batch job reservation',
      });
    }
  }

  // Create batch job document
  const jobRef = db.collection('batch_jobs').doc();
  
  const statusByVideo: Record<string, 'queued' | 'running' | 'completed' | 'failed'> = {};
  config.videoIds.forEach(videoId => {
    statusByVideo[videoId] = 'queued';
  });

  await jobRef.set({
    type: config.type,
    videoIds: config.videoIds,
    coachId: config.coachId,
    createdBy: config.createdBy,
    config: config.config || {},
    status: 'queued',
    progress: {
      total: config.videoIds.length,
      completed: 0,
      failed: 0,
      running: 0,
    },
    statusByVideo,
    reservedCredits: creditsToReserve,
    consumedCredits: 0,
    createdAt: Timestamp.now(),
    startedAt: null,
    completedAt: null,
  });

  console.log('[Batch] Job created:', {
    jobId: jobRef.id,
    type: config.type,
    videoCount: config.videoIds.length,
    reservedCredits: creditsToReserve,
  });

  return jobRef.id;
}

/**
 * Get batch job status
 */
export async function getBatchJobStatus(jobId: string) {
  const db = adminFirestore();
  const jobDoc = await db.collection('batch_jobs').doc(jobId).get();

  if (!jobDoc.exists) {
    throw new Error('Batch job not found');
  }

  const data = jobDoc.data()!;

  // Get recent logs
  const logsSnapshot = await db.collection(`batch_jobs/${jobId}/logs`)
    .orderBy('timestamp', 'desc')
    .limit(20)
    .get();

  const logs = logsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate()?.toISOString(),
  }));

  return {
    jobId,
    ...data,
    createdAt: data.createdAt?.toDate()?.toISOString(),
    startedAt: data.startedAt?.toDate()?.toISOString(),
    completedAt: data.completedAt?.toDate()?.toISOString(),
    logs,
  };
}

/**
 * Cancel a batch job
 */
export async function cancelBatchJob(jobId: string, actorId: string): Promise<void> {
  const db = adminFirestore();

  await db.runTransaction(async (transaction) => {
    const jobRef = db.collection('batch_jobs').doc(jobId);
    const jobDoc = await transaction.get(jobRef);

    if (!jobDoc.exists) {
      throw new Error('Batch job not found');
    }

    const data = jobDoc.data()!;

    if (data.status === 'completed' || data.status === 'cancelled') {
      throw new Error('Job already completed or cancelled');
    }

    // Update job status
    transaction.update(jobRef, {
      status: 'cancelled',
      completedAt: Timestamp.now(),
    });

    // Release reserved credits
    if (data.reservedCredits > data.consumedCredits) {
      const toRelease = data.reservedCredits - data.consumedCredits;
      await releaseReservedCredits(data.coachId, toRelease, actorId, {
        batchJobId: jobId,
        reason: 'Job cancelled',
      });
    }

    // Log cancellation
    const logRef = db.collection(`batch_jobs/${jobId}/logs`).doc();
    transaction.set(logRef, {
      action: 'cancel',
      actor: actorId,
      timestamp: Timestamp.now(),
    });
  });

  console.log('[Batch] Job cancelled:', { jobId, actorId });
}

/**
 * Prioritize a batch job (move up in queue)
 */
export async function prioritizeBatchJob(jobId: string, delta: number, actorId: string): Promise<void> {
  const db = adminFirestore();

  const jobRef = db.collection('batch_jobs').doc(jobId);
  const jobDoc = await jobRef.get();

  if (!jobDoc.exists) {
    throw new Error('Batch job not found');
  }

  const data = jobDoc.data()!;

  if (data.status !== 'queued') {
    throw new Error('Can only prioritize queued jobs');
  }

  // Add priority field (higher = sooner)
  const currentPriority = data.priority || 0;
  await jobRef.update({
    priority: currentPriority + delta,
    updatedAt: Timestamp.now(),
  });

  // Log prioritization
  await db.collection(`batch_jobs/${jobId}/logs`).add({
    action: 'prioritize',
    actor: actorId,
    delta,
    timestamp: Timestamp.now(),
  });

  console.log('[Batch] Job prioritized:', { jobId, delta, newPriority: currentPriority + delta });
}

/**
 * Update job progress for a single video
 */
export async function updateJobVideoStatus(
  jobId: string,
  videoId: string,
  status: 'running' | 'completed' | 'failed',
  creditsUsed?: number
): Promise<void> {
  const db = adminFirestore();

  await db.runTransaction(async (transaction) => {
    const jobRef = db.collection('batch_jobs').doc(jobId);
    const jobDoc = await transaction.get(jobRef);

    if (!jobDoc.exists) {
      throw new Error('Batch job not found');
    }

    const data = jobDoc.data()!;
    const statusByVideo = data.statusByVideo || {};
    const progress = data.progress || { total: 0, completed: 0, failed: 0, running: 0 };

    // Update status
    const oldStatus = statusByVideo[videoId];
    statusByVideo[videoId] = status;

    // Update counts
    if (oldStatus === 'running') progress.running--;
    if (status === 'running') progress.running++;
    if (status === 'completed') progress.completed++;
    if (status === 'failed') progress.failed++;

    const updates: any = {
      statusByVideo,
      progress,
    };

    // Update consumed credits
    if (creditsUsed && creditsUsed > 0) {
      updates.consumedCredits = (data.consumedCredits || 0) + creditsUsed;
    }

    // Check if job is complete
    if (progress.completed + progress.failed >= progress.total) {
      updates.status = 'completed';
      updates.completedAt = Timestamp.now();

      // Release unused reserved credits
      if (data.reservedCredits > updates.consumedCredits) {
        const toRelease = data.reservedCredits - updates.consumedCredits;
        await releaseReservedCredits(data.coachId, toRelease, 'system', {
          batchJobId: jobId,
          reason: 'Job completed',
        });
      }
    }

    transaction.update(jobRef, updates);
  });
}

/**
 * Get next video to process from queue (respects concurrency limits)
 */
export async function getNextVideoToProcess(coachId: string): Promise<{ jobId: string; videoId: string } | null> {
  const db = adminFirestore();
  const limits = await getConcurrencyLimits(coachId);

  // Check current running count for this coach
  const runningJobsSnapshot = await db.collection('batch_jobs')
    .where('coachId', '==', coachId)
    .where('status', '==', 'running')
    .get();

  let currentRunning = 0;
  runningJobsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    currentRunning += data.progress?.running || 0;
  });

  if (currentRunning >= limits.perCoach) {
    return null; // At capacity
  }

  // Find queued jobs for this coach (ordered by priority)
  const queuedJobsSnapshot = await db.collection('batch_jobs')
    .where('coachId', '==', coachId)
    .where('status', 'in', ['queued', 'running'])
    .orderBy('priority', 'desc')
    .orderBy('createdAt', 'asc')
    .limit(10)
    .get();

  for (const jobDoc of queuedJobsSnapshot.docs) {
    const data = jobDoc.data();
    const statusByVideo = data.statusByVideo || {};

    // Find first queued video
    for (const videoId of data.videoIds) {
      if (statusByVideo[videoId] === 'queued') {
        // Mark job as running if it was queued
        if (data.status === 'queued') {
          await jobDoc.ref.update({
            status: 'running',
            startedAt: Timestamp.now(),
          });
        }

        return {
          jobId: jobDoc.id,
          videoId,
        };
      }
    }
  }

  return null;
}

