import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { getCaptionContentByLanguage } from '@/lib/youtube/captions';
import { getValidAccessToken } from '@/lib/youtube/oauth';
import { getCachedOwnership } from '@/lib/youtube/ownership';
import { transcribeWithGoogle, transcribeWithWhisper, estimateTranscriptionCost } from '@/lib/youtube/transcription';
import { checkSufficientCredits, reserveCredits, consumeCredits, refundCredits } from '@/lib/credits/manager';
import { cleanFirestoreData } from '@/lib/utils';

/**
 * Fetch captions for a video via OAuth or AI
 * POST /api/videos/[videoId]/captions/fetch
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ videoId: string }> | { videoId: string } }
) {
  const startTime = Date.now();
  
  try {
    const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
    const { videoId } = params;

    const body = await request.json();
    const { 
      source, 
      language = 'en', 
      engine = 'google',
      userId 
    } = body;

    if (!source || !['oauth', 'ai'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid caption source. Must be "oauth" or "ai"' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

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

    // Update status to processing
    await videoRef.update({
      status: 'processing',
      updatedAt: Timestamp.now(),
    });

    let captionContent: string;
    let creditsUsed = 0;

    // Log processing start
    await db.collection(`videos/${videoId}/logs`).add(cleanFirestoreData({
      videoId,
      step: 'caption_fetch',
      status: 'started',
      actor: userId,
      metadata: {
        source,
        language,
        engine: source === 'ai' ? engine : undefined,
      },
      timestamp: Timestamp.now(),
    }));

    if (source === 'oauth') {
      // OAuth caption fetching
      // 1. Check ownership (trust imported videos)
      const isImportedFromPlaylist = videoData.source === 'youtube_playlist';
      let isOwned = isImportedFromPlaylist; // Trust imported videos

      if (!isOwned) {
        // Check cached ownership for non-imported videos
        const ownership = await getCachedOwnership(videoData.youtubeVideoId);
        isOwned = ownership?.owned || false;
      }

      if (!isOwned) {
        // Log failure
        await db.collection(`videos/${videoId}/logs`).add(cleanFirestoreData({
          videoId,
          step: 'caption_fetch',
          status: 'failed',
          actor: userId,
          metadata: {
            source,
            error: 'Video not owned by connected channel',
            errorCode: 'OWNERSHIP_FAILED',
          },
          timestamp: Timestamp.now(),
        }));

        await videoRef.update({
          status: 'failed',
          errorMessage: 'Video not owned by your connected YouTube channel',
          updatedAt: Timestamp.now(),
        });

        return NextResponse.json(
          { error: 'Video not owned by your connected YouTube channel. Please verify ownership first.' },
          { status: 403 }
        );
      }

      // 2. Get YouTube connection
      const connectionRef = db.collection('youtube_connections').doc(userId);
      const connectionDoc = await connectionRef.get();

      if (!connectionDoc.exists) {
        await videoRef.update({
          status: 'failed',
          errorMessage: 'YouTube not connected',
          updatedAt: Timestamp.now(),
        });

        return NextResponse.json(
          { error: 'YouTube not connected. Please connect your YouTube account first.' },
          { status: 400 }
        );
      }

      const connectionData = connectionDoc.data()!;

      // 3. Get valid access token
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

      // 4. Fetch caption content
      console.log('[Captions Fetch] Fetching captions for video:', {
        videoId: videoData.youtubeVideoId,
        language,
        source: videoData.source,
      });

      try {
      const captionData = await getCaptionContentByLanguage(
        videoData.youtubeVideoId,
        accessToken,
        language,
        'srt'
      );

      console.log('[Captions Fetch] Successfully fetched captions:', {
        language: captionData.language,
        contentLength: captionData.content.length,
        format: captionData.format,
        contentPreview: captionData.content.substring(0, 100),
      });

      captionContent = captionData.content;
      } catch (captionError) {
        console.error('[Captions Fetch] Failed to fetch captions:', captionError);

        // Log failure with specific error
        await db.collection(`videos/${videoId}/logs`).add(cleanFirestoreData({
          videoId,
          step: 'caption_fetch',
          status: 'failed',
          actor: userId,
          metadata: {
            source,
            language,
            error: captionError instanceof Error ? captionError.message : 'Failed to fetch captions from YouTube',
            errorCode: 'CAPTIONS_UNAVAILABLE',
            suggestion: 'Try uploading SRT file or use AI transcription',
          },
          timestamp: Timestamp.now(),
        }));

        await videoRef.update({
          status: 'failed',
          errorMessage: 'No captions available for this video. Please upload an SRT file or use AI transcription.',
          updatedAt: Timestamp.now(),
        });

        return NextResponse.json(
          {
            error: 'No captions available for this video. Please upload an SRT file or use AI transcription.',
            suggestion: 'captions_unavailable'
          },
          { status: 400 }
        );
      }

    } else if (source === 'ai') {
      // AI transcription with credit management
      const videoDuration = videoData.duration || 0;
      const { credits: creditsRequired } = estimateTranscriptionCost(videoDuration);

      // Check sufficient credits
      const creditCheck = await checkSufficientCredits(videoData.coachId, creditsRequired);
      
      if (!creditCheck.sufficient) {
        await videoRef.update({
          status: 'failed',
          errorMessage: `Insufficient credits. Need ${creditsRequired}, have ${creditCheck.available}`,
          updatedAt: Timestamp.now(),
        });

        return NextResponse.json(
          { 
            error: 'Insufficient credits',
            required: creditsRequired,
            available: creditCheck.available,
          },
          { status: 402 } // Payment Required
        );
      }

      // Reserve credits
      await reserveCredits(videoData.coachId, creditsRequired, userId, {
        videoId,
        reason: 'AI transcription',
      });

      try {
        // Get audio URI (assumes video audio is in Cloud Storage)
        // Format: gs://bucket/videos/{youtubeVideoId}/audio.mp3
        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        const audioUri = `gs://${bucketName}/videos/${videoData.youtubeVideoId}/audio.mp3`;

        // Transcribe based on engine
        let transcriptionResult;
        
        if (engine === 'whisper') {
          transcriptionResult = await transcribeWithWhisper(audioUri, {
            engine: 'whisper',
            language,
            enablePunctuation: true,
          });
        } else {
          transcriptionResult = await transcribeWithGoogle(audioUri, {
            engine: 'google',
            language,
            enablePunctuation: true,
          });
        }

        captionContent = transcriptionResult.transcript;
        creditsUsed = creditsRequired;

        // Consume reserved credits
        await consumeCredits(videoData.coachId, creditsRequired, userId, {
          videoId,
          reason: `AI transcription (${engine})`,
        });

        // Update video with credits consumed
        await videoRef.update({
          creditsConsumed: (videoData.creditsConsumed || 0) + creditsUsed,
        });

      } catch (transcriptionError) {
        // Refund credits on failure
        await refundCredits(videoData.coachId, creditsRequired, userId, {
          videoId,
          reason: 'AI transcription failed',
        });

        throw transcriptionError;
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid caption source' },
        { status: 400 }
      );
    }

    // Store caption content
    await videoRef.update({
      captionSource: source,
      captionLanguage: language,
      hasCaptions: true,
      status: 'not_ready', // Back to not_ready, waiting for next step
      errorMessage: null,
      updatedAt: Timestamp.now(),
    });

    // Store caption text in subcollection
    await db.collection(`videos/${videoId}/captions`).doc('current').set({
      content: captionContent,
      language,
      source,
      format: 'srt',
      createdAt: Timestamp.now(),
    });

    // Log success
    const duration = Date.now() - startTime;
    await db.collection(`videos/${videoId}/logs`).add(cleanFirestoreData({
      videoId,
      step: 'caption_fetch',
      status: 'completed',
      actor: userId,
      metadata: {
        source,
        language,
        credits: creditsUsed,
        duration,
      },
      timestamp: Timestamp.now(),
    }));

    console.log('[Captions Fetch] Success:', {
      videoId,
      source,
      language,
      duration,
      captionLength: captionContent.length,
    });

    return NextResponse.json({
      success: true,
      captionTrack: {
        language,
        length: captionContent.length,
      },
      creditsUsed,
      duration,
    });
  } catch (error) {
    const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
    const { videoId } = params;
    
    console.error('[Captions Fetch] Failed:', error);

    // Update video status to failed
    try {
      const db = adminFirestore();
      await db.collection('videos').doc(videoId).update({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Caption fetch failed',
        updatedAt: Timestamp.now(),
      });

      // Log failure
      const body = await request.json().catch(() => ({}));
      await db.collection(`videos/${videoId}/logs`).add(cleanFirestoreData({
        videoId,
        step: 'caption_fetch',
        status: 'failed',
        actor: body.userId || 'unknown',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          errorCode: 'CAPTION_FETCH_FAILED',
          duration: Date.now() - startTime,
        },
        timestamp: Timestamp.now(),
      }));
    } catch (updateError) {
      console.error('[Captions Fetch] Failed to update status:', updateError);
    }

    return NextResponse.json(
      { 
        error: 'Failed to fetch captions',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

