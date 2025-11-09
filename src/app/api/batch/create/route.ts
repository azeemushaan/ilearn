import { NextRequest, NextResponse } from 'next/server';
import { createBatchJob } from '@/lib/batch/manager';

/**
 * Create a batch processing job
 * POST /api/batch/create
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, videoIds, coachId, userId, config } = body;

    if (!type || !videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: type and videoIds array required' },
        { status: 400 }
      );
    }

    if (!coachId || !userId) {
      return NextResponse.json(
        { error: 'Coach ID and user ID required' },
        { status: 400 }
      );
    }

    const jobId = await createBatchJob({
      type,
      videoIds,
      coachId,
      createdBy: userId,
      config,
    });

    console.log('[Batch API] Job created:', {
      jobId,
      type,
      videoCount: videoIds.length,
    });

    return NextResponse.json({
      success: true,
      jobId,
      videoCount: videoIds.length,
    });
  } catch (error) {
    console.error('[Batch API] Create failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create batch job',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

