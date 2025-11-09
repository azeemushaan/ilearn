import { NextRequest, NextResponse } from 'next/server';
import { prioritizeBatchJob } from '@/lib/batch/manager';

/**
 * Prioritize a batch job (admin only)
 * POST /api/batch/[jobId]/prioritize
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ jobId: string }> | { jobId: string } }
) {
  try {
    const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
    const { jobId } = params;

    const body = await request.json();
    const { userId, delta = 10 } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    await prioritizeBatchJob(jobId, delta, userId);

    return NextResponse.json({
      success: true,
      message: 'Batch job prioritized successfully',
    });
  } catch (error) {
    console.error('[Batch API] Prioritize failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to prioritize batch job',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

