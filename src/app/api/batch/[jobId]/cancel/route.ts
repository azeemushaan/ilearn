import { NextRequest, NextResponse } from 'next/server';
import { cancelBatchJob } from '@/lib/batch/manager';

/**
 * Cancel a batch job
 * POST /api/batch/[jobId]/cancel
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ jobId: string }> | { jobId: string } }
) {
  try {
    const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
    const { jobId } = params;

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    await cancelBatchJob(jobId, userId);

    return NextResponse.json({
      success: true,
      message: 'Batch job cancelled successfully',
    });
  } catch (error) {
    console.error('[Batch API] Cancel failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to cancel batch job',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

