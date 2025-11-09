import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase/admin';
import { listUserChannels, getValidAccessToken } from '@/lib/youtube/oauth';

/**
 * List connected YouTube channels for authenticated user
 * GET /api/youtube/channels
 */
export async function GET(request: NextRequest) {
  try {
    // Get user ID from query params
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    // Fetch connection from Firestore
    const db = adminFirestore();
    const connectionRef = db.collection('youtube_connections').doc(userId);
    const connectionDoc = await connectionRef.get();

    if (!connectionDoc.exists) {
      return NextResponse.json({
        connected: false,
        channels: [],
      });
    }

    const connectionData = connectionDoc.data()!;

    // Check if token needs refresh
    const expiresAt = connectionData.expiresAt?.toDate() || new Date(0);
    const { accessToken, refreshed } = await getValidAccessToken(
      connectionData.accessToken,
      connectionData.refreshToken,
      expiresAt
    );

    // If token was refreshed, update in Firestore
    if (refreshed) {
      await connectionRef.update({
        accessToken,
        updatedAt: new Date(),
      });
    }

    // Fetch fresh channel list
    const channels = await listUserChannels(accessToken);

    // Update channels in Firestore if they changed
    if (JSON.stringify(channels) !== JSON.stringify(connectionData.channels)) {
      await connectionRef.update({
        channels: channels.map(ch => ({
          channelId: ch.channelId,
          title: ch.title,
          thumbnailUrl: ch.thumbnailUrl || null,
          connectedAt: new Date(),
        })),
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({
      connected: true,
      channels,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('[YouTube Channels] Failed to fetch channels:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch YouTube channels',
        message: error instanceof Error ? error.message : 'Unknown error',
        connected: false,
      },
      { status: 500 }
    );
  }
}

