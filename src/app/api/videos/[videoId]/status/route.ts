import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase/admin';

/**
 * Get real-time video processing status
 * GET /api/videos/[videoId]/status
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ videoId: string }> | { videoId: string } }
) {
  try {
    const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
    const { videoId } = params;

    const db = adminFirestore();
    const videoRef = db.collection('videos').doc(videoId);
    const videoDoc = await videoRef.get();

    if (!videoDoc.exists) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const videoData = videoDoc.data()!;

    // Get latest processing logs
    const logsSnapshot = await db
      .collection(`videos/${videoId}/logs`)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const logs = logsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate()?.toISOString(),
    }));

    // Determine current step
    let currentStep: string | null = null;
    let progress: number = 0;

    if (videoData.status === 'processing') {
      const latestLog = logs.find(log => log.status === 'started');
      currentStep = latestLog?.step || null;

      // Calculate progress based on completed steps
      const steps = ['caption_fetch', 'segment', 'mcq_generate', 'manifest_build'];
      const completedSteps = logs.filter(log => log.status === 'completed').map(log => log.step);
      const uniqueCompleted = [...new Set(completedSteps)];
      progress = (uniqueCompleted.length / steps.length) * 100;
    }

    return NextResponse.json({
      videoId,
      status: videoData.status,
      currentStep,
      progress,
      hasCaptions: videoData.hasCaptions || false,
      segmentCount: videoData.segmentCount || 0,
      errorMessage: videoData.errorMessage || null,
      logs,
      captionSource: videoData.captionSource || 'unknown',
      captionLanguage: videoData.captionLanguage || null,
      mcqLanguage: videoData.mcqLanguage || null,
    });
  } catch (error) {
    console.error('[Video Status] Failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch video status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

