import { NextRequest, NextResponse } from 'next/server';
import { refundCredits } from '@/lib/credits/manager';

/**
 * Refund credits on failure
 * POST /api/credits/refund
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

    const result = await refundCredits(coachId, amount, userId, {
      videoId,
      batchJobId,
      reason,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Credits Refund] Failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to refund credits',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

