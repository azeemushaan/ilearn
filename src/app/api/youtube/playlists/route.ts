import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase/admin';
import { getValidAccessToken, listUserChannels } from '@/lib/youtube/oauth';
import { google } from 'googleapis';

const youtube = google.youtube('v3');

/**
 * Fetch YouTube playlists for authenticated user
 * GET /api/youtube/playlists?userId=...
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
        playlists: [],
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
        updatedAt: new Date(),
      });
    }

    // Fetch playlists from YouTube
    const oauth2Client = (await import('@/lib/youtube/oauth')).getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const playlistsResponse = await youtube.playlists.list({
      auth: oauth2Client,
      part: ['snippet', 'status', 'contentDetails'],
      mine: true, // Only playlists owned by the authenticated user
      maxResults: 50,
    });

    if (!playlistsResponse.data.items) {
      return NextResponse.json({
        connected: true,
        playlists: [],
      });
    }

    // For each playlist, get the actual accessible video count
    const playlistsWithCounts = await Promise.all(
      playlistsResponse.data.items.map(async (playlist) => {
        const playlistId = playlist.id!;
        let actualVideoCount = 0;

        try {
          // Get actual video count by fetching playlist items
          const itemsResponse = await youtube.playlistItems.list({
            auth: oauth2Client,
            part: ['contentDetails', 'status'], // Add status to check privacy
            playlistId: playlistId,
            maxResults: 50, // Just get a sample to count
          });

          console.log(`[Playlists] Items for ${playlistId}:`, {
            totalItems: itemsResponse.data.items?.length,
            items: itemsResponse.data.items?.map(item => ({
              videoId: item.contentDetails?.videoId,
              privacyStatus: item.status?.privacyStatus,
            })),
          });

          actualVideoCount = itemsResponse.data.items?.filter(
            item => item.contentDetails?.videoId
          ).length || 0;
        } catch (error) {
          console.log(`[Playlists] Could not count videos for ${playlistId}:`, error);
          // Fallback to reported count
          actualVideoCount = playlist.contentDetails?.itemCount || 0;
        }

        return {
          playlistId,
          title: playlist.snippet?.title || 'Untitled Playlist',
          description: playlist.snippet?.description || '',
          thumbnailUrl: playlist.snippet?.thumbnails?.medium?.url ||
                       playlist.snippet?.thumbnails?.default?.url,
      videoCount: actualVideoCount,
      reportedVideoCount: playlist.contentDetails?.itemCount || 0,
          privacyStatus: playlist.status?.privacyStatus || 'private',
          channelId: playlist.snippet?.channelId,
          channelTitle: playlist.snippet?.channelTitle,
          publishedAt: playlist.snippet?.publishedAt,
        };
      })
    );

    console.log('[YouTube Playlists] Fetched playlists:', {
      userId,
      count: playlistsWithCounts.length,
      playlists: playlistsWithCounts.map(p => ({
        id: p.playlistId,
        title: p.title,
        videoCount: p.videoCount,
        reportedVideoCount: p.reportedVideoCount,
      })),
    });

    return NextResponse.json({
      connected: true,
      playlists: playlistsWithCounts,
      totalResults: playlistsResponse.data.pageInfo?.totalResults || 0,
    });
  } catch (error) {
    console.error('[YouTube Playlists] Failed to fetch playlists:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch YouTube playlists',
        message: error instanceof Error ? error.message : 'Unknown error',
        connected: false,
      },
      { status: 500 }
    );
  }
}
