import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase/admin';

/**
 * Get video details
 * GET /api/videos/[videoId]
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

    return NextResponse.json({
      id: videoId,
      ...videoData,
    });
  } catch (error) {
    console.error('[Video API] Failed to get video:', error);
    return NextResponse.json(
      {
        error: 'Failed to get video',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
