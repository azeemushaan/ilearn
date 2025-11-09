import { NextRequest, NextResponse } from 'next/server';
import { getBatchJobStatus } from '@/lib/batch/manager';

/**
 * Get batch job status
 * GET /api/batch/[jobId]/status
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ jobId: string }> | { jobId: string } }
) {
  try {
    const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
    const { jobId } = params;

    const status = await getBatchJobStatus(jobId);

    return NextResponse.json(status);
  } catch (error) {
    console.error('[Batch API] Status fetch failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch batch job status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

