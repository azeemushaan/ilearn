import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase/admin';
import { revokeToken } from '@/lib/youtube/oauth';
import { invalidateUserOwnershipCache } from '@/lib/youtube/ownership';

/**
 * Disconnect YouTube account and revoke access
 * POST /api/youtube/disconnect
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    const db = adminFirestore();
    const connectionRef = db.collection('youtube_connections').doc(userId);
    const connectionDoc = await connectionRef.get();

    if (!connectionDoc.exists) {
      return NextResponse.json({
        success: true,
        message: 'No YouTube connection found',
      });
    }

    const connectionData = connectionDoc.data()!;

    // Revoke access token with YouTube
    try {
      await revokeToken(connectionData.accessToken);
    } catch (revokeError) {
      console.warn('[YouTube Disconnect] Failed to revoke token:', revokeError);
      // Continue anyway - we'll delete our local copy
    }

    // Delete connection document
    await connectionRef.delete();

    // Invalidate all ownership cache entries for this user
    await invalidateUserOwnershipCache(userId);

    console.log('[YouTube Disconnect] Successfully disconnected:', { userId });

    return NextResponse.json({
      success: true,
      message: 'YouTube account disconnected successfully',
    });
  } catch (error) {
    console.error('[YouTube Disconnect] Failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to disconnect YouTube account',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

