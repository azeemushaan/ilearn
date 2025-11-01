import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { 
  fetchPlaylistMetadata, 
  fetchPlaylistVideos, 
  fetchVideosMetadata 
} from '@/lib/youtube/api';

export async function POST(request: NextRequest) {
  try {
    const { youtubePlaylistId, coachId } = await request.json();

    if (!youtubePlaylistId || !coachId) {
      return NextResponse.json(
        { error: 'Missing youtubePlaylistId or coachId' },
        { status: 400 }
      );
    }

    const db = adminFirestore();

    // Find the playlist document
    const playlistsSnapshot = await db
      .collection('playlists')
      .where('youtubePlaylistId', '==', youtubePlaylistId)
      .where('coachId', '==', coachId)
      .limit(1)
      .get();

    if (playlistsSnapshot.empty) {
      return NextResponse.json(
        { error: 'Playlist not found' },
        { status: 404 }
      );
    }

    const playlistDoc = playlistsSnapshot.docs[0];

    // Update status to processing
    await playlistDoc.ref.update({
      status: 'processing',
      updatedAt: Timestamp.now(),
    });

    try {
      // Fetch playlist metadata from YouTube
      const playlistMetadata = await fetchPlaylistMetadata(youtubePlaylistId);

      // Update playlist with YouTube data
      await playlistDoc.ref.update({
        title: playlistMetadata.title,
        description: playlistMetadata.description || '',
        videoCount: playlistMetadata.itemCount,
        updatedAt: Timestamp.now(),
      });

      // Fetch all video IDs from the playlist
      const videoIds = await fetchPlaylistVideos(youtubePlaylistId);

      if (videoIds.length === 0) {
        await playlistDoc.ref.update({
          status: 'error',
          updatedAt: Timestamp.now(),
        });
        return NextResponse.json(
          { error: 'No videos found in playlist' },
          { status: 400 }
        );
      }

      // Fetch video metadata in batches
      const videosMetadata = await fetchVideosMetadata(videoIds);

      // Create video documents
      const batch = db.batch();
      const videoRefs: string[] = [];

      for (const video of videosMetadata) {
        // Check if video already exists
        const existingVideo = await db
          .collection('videos')
          .where('youtubeVideoId', '==', video.id)
          .where('playlistId', '==', playlistDoc.id)
          .limit(1)
          .get();

        if (!existingVideo.empty) {
          videoRefs.push(existingVideo.docs[0].id);
          continue;
        }

        const videoRef = db.collection('videos').doc();
        batch.set(videoRef, {
          playlistId: playlistDoc.id,
          coachId,
          youtubeVideoId: video.id,
          title: video.title,
          description: video.description,
          duration: video.duration,
          thumbnailUrl: video.thumbnailUrl,
          hasCaptions: false, // Will be updated during preprocessing
          chaptersOnly: false,
          status: 'pending',
          segmentCount: 0,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        videoRefs.push(videoRef.id);
      }

      await batch.commit();

      // Update playlist status to ready
      await playlistDoc.ref.update({
        status: 'ready',
        videoCount: videosMetadata.length,
        updatedAt: Timestamp.now(),
      });

      // Trigger video preprocessing for each video
      // This can be done via Cloud Functions or as a separate API call
      // For now, we'll return success and let the coach trigger preprocessing manually
      // or implement automatic processing via Cloud Tasks/Functions

      return NextResponse.json({
        success: true,
        message: 'Playlist processed successfully',
        playlistId: playlistDoc.id,
        videosCreated: videosMetadata.length,
        videoRefs,
      });
    } catch (error: any) {
      // Update playlist status to error
      await playlistDoc.ref.update({
        status: 'error',
        updatedAt: Timestamp.now(),
      });

      throw error;
    }
  } catch (error: any) {
    console.error('Error ingesting playlist:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to ingest playlist' },
      { status: 500 }
    );
  }
}
