import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase/admin';
import { batchOwnershipPreflight } from '@/lib/youtube/ownership';
import { getValidAccessToken } from '@/lib/youtube/oauth';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Batch ownership preflight for all videos in a playlist
 * POST /api/playlists/[playlistId]/ownership-preflight
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ playlistId: string }> | { playlistId: string } }
) {
  try {
    const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
    const { playlistId } = params;

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    const db = adminFirestore();

    // Fetch playlist
    const playlistRef = db.collection('playlists').doc(playlistId);
    const playlistDoc = await playlistRef.get();

    if (!playlistDoc.exists) {
      return NextResponse.json(
        { error: 'Playlist not found' },
        { status: 404 }
      );
    }

    // Fetch all videos in playlist
    const videosSnapshot = await db
      .collection('videos')
      .where('playlistId', '==', playlistId)
      .get();

    const videoIds = videosSnapshot.docs.map(doc => doc.data().youtubeVideoId);

    if (videoIds.length === 0) {
      return NextResponse.json({
        owned: [],
        notOwned: [],
        unknown: [],
        totalVideos: 0,
      });
    }

    // Fetch YouTube connection
    const connectionRef = db.collection('youtube_connections').doc(userId);
    const connectionDoc = await connectionRef.get();

    if (!connectionDoc.exists) {
      // No YouTube connection - all videos are "unknown" (OAuth not available)
      return NextResponse.json({
        owned: [],
        notOwned: [],
        unknown: videoIds,
        totalVideos: videoIds.length,
        message: 'YouTube not connected',
      });
    }

    const connectionData = connectionDoc.data()!;

    // Get valid access token
    const expiresAt = connectionData.expiresAt?.toDate() || new Date(0);
    const { accessToken, refreshed } = await getValidAccessToken(
      connectionData.accessToken,
      connectionData.refreshToken,
      expiresAt
    );

    if (refreshed) {
      await connectionRef.update({
        accessToken,
        updatedAt: Timestamp.now(),
      });
    }

    // Run batch ownership check
    const result = await batchOwnershipPreflight(videoIds, accessToken, userId);

    // Store results in playlist document
    await playlistRef.update({
      ownershipPreflightStatus: 'completed',
      ownershipResults: {
        owned: result.owned,
        notOwned: result.notOwned,
        unknown: result.unknown,
        checkedAt: Timestamp.now(),
      },
      updatedAt: Timestamp.now(),
    });

    console.log('[Ownership Preflight] Batch check complete:', {
      playlistId,
      totalVideos: videoIds.length,
      owned: result.owned.length,
      notOwned: result.notOwned.length,
      unknown: result.unknown.length,
    });

    return NextResponse.json({
      owned: result.owned,
      notOwned: result.notOwned,
      unknown: result.unknown,
      totalVideos: videoIds.length,
      summary: {
        ownedCount: result.owned.length,
        notOwnedCount: result.notOwned.length,
        unknownCount: result.unknown.length,
      },
    });
  } catch (error) {
    console.error('[Ownership Preflight] Failed:', error);
    
    const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
    const { playlistId } = params;

    // Update playlist with failed status
    try {
      const db = adminFirestore();
      await db.collection('playlists').doc(playlistId).update({
        ownershipPreflightStatus: 'failed',
        updatedAt: Timestamp.now(),
      });
    } catch (updateError) {
      console.error('[Ownership Preflight] Failed to update playlist status:', updateError);
    }

    return NextResponse.json(
      { 
        error: 'Ownership preflight failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

