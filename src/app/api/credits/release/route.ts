import { NextRequest, NextResponse } from 'next/server';
import { releaseReservedCredits } from '@/lib/credits/manager';

/**
 * Release unused reserved credits
 * POST /api/credits/release
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coachId, amount, userId, videoId, batchJobId, reason } = body;

    if (!coachId || !amount || !userId) {
      return NextResponse.json(
        { error: 'Coach ID, amount, and user ID required' },
        { status: 400 }
      );
    }

    const result = await releaseReservedCredits(coachId, amount, userId, {
      videoId,
      batchJobId,
      reason,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Credits Release] Failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to release credits',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

