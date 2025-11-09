import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase/admin';
import { getValidAccessToken } from '@/lib/youtube/oauth';
import { google } from 'googleapis';
import { Timestamp } from 'firebase-admin/firestore';

const youtube = google.youtube('v3');

/**
 * Import a YouTube playlist directly
 * POST /api/playlists/import-youtube
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, coachId, playlistId, playlistTitle, playlistDescription } = body;

    if (!userId || !playlistId || !playlistTitle) {
      return NextResponse.json(
        { error: 'User ID, playlist ID, and title are required' },
        { status: 400 }
      );
    }

    const db = adminFirestore();

    // Fetch YouTube connection
    const connectionRef = db.collection('youtube_connections').doc(userId);
    const connectionDoc = await connectionRef.get();

    if (!connectionDoc.exists) {
      return NextResponse.json(
        { error: 'YouTube not connected. Please connect your YouTube account first.' },
        { status: 400 }
      );
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

    // Set up OAuth client
    const oauth2Client = (await import('@/lib/youtube/oauth')).getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    // Fetch playlist items from YouTube
    const playlistItemsResponse = await youtube.playlistItems.list({
      auth: oauth2Client,
      part: ['snippet', 'contentDetails'],
      playlistId: playlistId,
      maxResults: 50, // YouTube API limit
    });

    console.log('[Playlist Import] YouTube API response:', {
      playlistId,
      totalResults: playlistItemsResponse.data.pageInfo?.totalResults,
      resultsPerPage: playlistItemsResponse.data.pageInfo?.resultsPerPage,
      itemsCount: playlistItemsResponse.data.items?.length,
      firstItem: playlistItemsResponse.data.items?.[0],
    });

    if (!playlistItemsResponse.data.items || playlistItemsResponse.data.items.length === 0) {
      return NextResponse.json(
        { error: 'No videos found in playlist' },
        { status: 400 }
      );
    }

    const playlistItems = playlistItemsResponse.data.items;
    const videoIds = playlistItems.map(item => item.contentDetails?.videoId).filter(Boolean) as string[];

    console.log('[Playlist Import] Extracted video IDs:', {
      totalItems: playlistItems.length,
      validVideoIds: videoIds.length,
      videoIds: videoIds.slice(0, 5), // Show first 5
      sampleItem: {
        ...playlistItems[0],
        snippet: {
          ...playlistItems[0]?.snippet,
          description: playlistItems[0]?.snippet?.description?.substring(0, 100) + '...', // Truncate
        },
      },
      allItemsDetails: playlistItems.map((item, index) => ({
        index,
        videoId: item.contentDetails?.videoId,
        title: item.snippet?.title,
        privacyStatus: item.status?.privacyStatus,
        channelTitle: item.snippet?.channelTitle,
      })),
    });

    if (videoIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid videos found in playlist' },
        { status: 400 }
      );
    }

    // Create playlist document
    const playlistRef = db.collection('playlists').doc();
    const playlistData = {
      id: playlistRef.id,
      title: playlistTitle,
      description: playlistDescription || '',
      coachId: coachId || userId,
      youtubePlaylistId: playlistId,
      videoIds: videoIds,
      videoCount: videoIds.length,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      status: 'imported',
      ownershipPreflightStatus: 'completed', // Since we're importing from authenticated account
      ownershipResults: {
        owned: videoIds, // All videos are owned since they're from user's playlist
        notOwned: [],
        unknown: [],
        checkedAt: Timestamp.now(),
      },
      source: 'youtube_import',
    };

    await playlistRef.set(playlistData);

    // Create video documents
    const batch = db.batch();
    const videosRef = db.collection('videos');

    playlistItems.forEach((item, index) => {
      if (item.snippet && item.contentDetails?.videoId) {
        const videoId = item.contentDetails.videoId;
        const videoRef = videosRef.doc();

        const videoData = {
          id: videoRef.id,
          youtubeVideoId: videoId,
          title: item.snippet.title || 'Untitled Video',
          description: item.snippet.description || '',
          thumbnailUrl: item.snippet.thumbnails?.medium?.url ||
                       item.snippet.thumbnails?.default?.url || null,
          duration: null, // Will be fetched later if needed
          playlistId: playlistRef.id,
          coachId: coachId || userId,
          order: index,
          status: 'not_ready', // Ready for processing
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          source: 'youtube_playlist',
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt ? Timestamp.fromDate(new Date(item.snippet.publishedAt)) : null,
        };

        batch.set(videoRef, videoData);
      }
    });

    await batch.commit();

    console.log('[Playlist Import] Successfully imported:', {
      playlistId: playlistRef.id,
      youtubePlaylistId: playlistId,
      videoCount: videoIds.length,
      userId,
      totalItemsInPlaylist: playlistItems.length,
      validVideoIds: videoIds.length,
    });

    return NextResponse.json({
      success: true,
      playlistId: playlistRef.id,
      videoCount: videoIds.length,
      message: `Successfully imported playlist with ${videoIds.length} videos`,
      debug: {
        totalItemsInPlaylist: playlistItems.length,
        validVideoIds: videoIds.length,
        youtubeReportedCount: playlistItemsResponse.data.pageInfo?.totalResults,
      },
    });
  } catch (error) {
    console.error('[Playlist Import] Failed:', error);

    return NextResponse.json(
      {
        error: 'Failed to import playlist',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
