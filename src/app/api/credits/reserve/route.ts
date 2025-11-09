import { NextRequest, NextResponse } from 'next/server';
import { reserveCredits } from '@/lib/credits/manager';

/**
 * Reserve credits for processing
 * POST /api/credits/reserve
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

    const result = await reserveCredits(coachId, amount, userId, {
      videoId,
      batchJobId,
      reason,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Credits Reserve] Failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to reserve credits',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

