import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase/admin';
import { getCachedOwnership, verifyVideoOwnership, invalidateOwnershipCache } from '@/lib/youtube/ownership';
import { getValidAccessToken } from '@/lib/youtube/oauth';

/**
 * Check video ownership status
 * GET /api/videos/[videoId]/ownership
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ videoId: string }> | { videoId: string } }
) {
  try {
    const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
    const { videoId } = params;

    // Check cache first
    const cached = await getCachedOwnership(videoId);

    if (cached) {
      return NextResponse.json({
        videoId,
        owned: cached.owned,
        channelId: cached.channelId,
        cached: true,
        verifiedAt: cached.verifiedAt.toISOString(),
        cacheAge: Date.now() - cached.verifiedAt.getTime(),
      });
    }

    return NextResponse.json({
      videoId,
      owned: false,
      cached: false,
      status: 'unknown',
      message: 'Ownership not verified. Use POST to verify.',
    });
  } catch (error) {
    console.error('[Ownership API] GET failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check ownership',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Force ownership verification
 * POST /api/videos/[videoId]/ownership
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ videoId: string }> | { videoId: string } }
) {
  try {
    const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
    const { videoId } = params;

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    // Fetch YouTube connection
    const db = adminFirestore();
    const connectionRef = db.collection('youtube_connections').doc(userId);
    const connectionDoc = await connectionRef.get();

    if (!connectionDoc.exists) {
      return NextResponse.json(
        { error: 'YouTube not connected. Please connect your YouTube account first.' },
        { status: 400 }
      );
    }

    const connectionData = connectionDoc.data()!;

    // Get valid access token (refresh if needed)
    const expiresAt = connectionData.expiresAt?.toDate() || new Date(0);
    const { accessToken, refreshed } = await getValidAccessToken(
      connectionData.accessToken,
      connectionData.refreshToken,
      expiresAt
    );

    // Update token in Firestore if refreshed
    if (refreshed) {
      await connectionRef.update({
        accessToken,
        updatedAt: new Date(),
      });
    }

    // Verify ownership
    const result = await verifyVideoOwnership(videoId, accessToken, userId);

    console.log('[Ownership API] Verification complete:', {
      videoId,
      owned: result.owned,
      channelId: result.channelId,
      userId,
    });

    // Also log stored channels for debugging
    console.log('[Ownership API] Stored channels:', {
      userId,
      storedChannels: connectionData.channels?.map((ch: any) => ch.channelId) || [],
    });

    return NextResponse.json({
      videoId,
      owned: result.owned,
      channelId: result.channelId,
      cached: result.cached,
      verifiedAt: result.verifiedAt.toISOString(),
    });
  } catch (error) {
    console.error('[Ownership API] POST failed:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to verify ownership',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Clear ownership cache for a video
 * DELETE /api/videos/[videoId]/ownership
 */
export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ videoId: string }> | { videoId: string } }
) {
  try {
    const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
    const { videoId } = params;

    await invalidateOwnershipCache(videoId);

    console.log('[Ownership API] Cache cleared for video:', videoId);

    return NextResponse.json({
      success: true,
      message: 'Ownership cache cleared',
      videoId,
    });
  } catch (error) {
    console.error('[Ownership API] DELETE failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to clear ownership cache',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

