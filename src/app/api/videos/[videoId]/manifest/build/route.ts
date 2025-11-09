import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, adminStorage } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { videoManifestSchema } from '@/lib/schemas';
import { notifyVideoReady, notifyStudentsVideoReady } from '@/lib/notifications/manager';
import { cleanFirestoreData } from '@/lib/utils';

/**
 * Build and cache video manifest
 * POST /api/videos/[videoId]/manifest/build
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
    const { userId } = body;

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

    // Check if segments and questions exist
    const segmentsSnapshot = await db
      .collection(`videos/${videoId}/segments`)
      .orderBy('tStartSec')
      .get();

    if (segmentsSnapshot.empty) {
      return NextResponse.json(
        { error: 'No segments found. Please segment the transcript first.' },
        { status: 400 }
      );
    }

    // Update status to processing
    await videoRef.update({
      status: 'processing',
      updatedAt: Timestamp.now(),
    });

    // Log processing start
    await db.collection(`videos/${videoId}/logs`).add(cleanFirestoreData({
      videoId,
      step: 'manifest_build',
      status: 'started',
      actor: userId,
      metadata: {},
      timestamp: Timestamp.now(),
    }));

    // Build manifest
    const segments = [];
    let totalQuestions = 0;

    for (const segmentDoc of segmentsSnapshot.docs) {
      const segmentData = segmentDoc.data();

      // Fetch questions for this segment
      const questionsSnapshot = await db
        .collection(`videos/${videoId}/segments/${segmentDoc.id}/questions`)
        .get();

      const questionIds = questionsSnapshot.docs.map(q => q.id);
      totalQuestions += questionIds.length;

      segments.push({
        segmentId: segmentDoc.id,
        segmentIndex: segmentData.segmentIndex,
        tStartSec: segmentData.tStartSec,
        tEndSec: segmentData.tEndSec,
        durationSec: segmentData.tEndSec - segmentData.tStartSec,
        questionIds,
        difficulty: segmentData.difficulty,
      });
    }

    // Calculate duration from segments if not available in video data
    let videoDuration = videoData.duration;
    if (!videoDuration && segments.length > 0) {
      // Find the maximum end time from all segments
      const maxEndTime = Math.max(...segments.map(s => s.tEndSec));
      videoDuration = Math.ceil(maxEndTime); // Round up to nearest second
      console.log('[Manifest Build] Calculated duration from segments:', videoDuration);
    }

    if (!videoDuration) {
      throw new Error('Unable to determine video duration. Please ensure video metadata is complete.');
    }

    const manifest = {
      videoId,
      youtubeVideoId: videoData.youtubeVideoId,
      title: videoData.title,
      duration: videoDuration,
      status: 'ready' as const,
      hasCaptions: videoData.hasCaptions || false,
      chaptersOnly: videoData.chaptersOnly || false,
      segments,
      totalSegments: segments.length,
      totalQuestions,
      generatedAt: new Date().toISOString(),
      version: '1.0',
    };

    // Validate manifest
    const validatedManifest = videoManifestSchema.parse(manifest);

    // Cache manifest to Cloud Storage
    let manifestUrl: string | null = null;
    
    try {
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      
      if (bucketName) {
        const bucket = adminStorage().bucket();
        const manifestPath = `manifests/${videoId}.json`;
        const file = bucket.file(manifestPath);

        await file.save(JSON.stringify(validatedManifest, null, 2), {
          metadata: {
            contentType: 'application/json',
            metadata: {
              coachId: videoData.coachId || '',
              videoId: videoId,
              generatedAt: new Date().toISOString(),
            },
          },
        });

        manifestUrl = `gs://${bucketName}/${manifestPath}`;
        
        console.log('[Manifest Build] Cached to Cloud Storage:', manifestUrl);
      } else {
        console.warn('[Manifest Build] Storage bucket not configured, skipping cache');
      }
    } catch (cacheError) {
      console.error('[Manifest Build] Failed to cache manifest:', cacheError);
      // Non-fatal - continue
    }

    // Update video to ready status
    const updateData: any = {
      status: 'ready',
      flags: {
        lockedReady: true,
      },
      errorMessage: null,
      updatedAt: Timestamp.now(),
    };

    // Update duration if we calculated it
    if (!videoData.duration && videoDuration) {
      updateData.duration = videoDuration;
    }

    await videoRef.update(updateData);

    // Log success
    const duration = Date.now() - startTime;
    await db.collection(`videos/${videoId}/logs`).add(cleanFirestoreData({
      videoId,
      step: 'manifest_build',
      status: 'completed',
      actor: userId,
      metadata: {
        totalSegments: segments.length,
        totalQuestions,
        ...(manifestUrl && { manifestUrl }),
        duration,
      },
      timestamp: Timestamp.now(),
    }));

    console.log('[Manifest Build] Success:', {
      videoId,
      totalSegments: segments.length,
      totalQuestions,
      duration,
    });

    // Send notifications
    try {
      // Notify coach
      await notifyVideoReady(videoData.coachId, videoId, videoData.title);

      // Find assignments with this video and notify students
      const assignmentsSnapshot = await db.collection('assignments')
        .where('playlistId', '==', videoData.playlistId)
        .get();

      for (const assignmentDoc of assignmentsSnapshot.docs) {
        const assignmentData = assignmentDoc.data();
        const studentIds = assignmentData.studentIds || [];
        
        if (studentIds.length > 0) {
          await notifyStudentsVideoReady(
            studentIds,
            videoId,
            videoData.title,
            assignmentDoc.id
          );
        }
      }
    } catch (notificationError) {
      console.error('[Manifest Build] Failed to send notifications:', notificationError);
      // Non-fatal - continue
    }

    return NextResponse.json({
      success: true,
      manifestUrl,
      totalSegments: segments.length,
      totalQuestions,
      duration,
    });
  } catch (error) {
    const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
    const { videoId } = params;
    
    console.error('[Manifest Build] Failed:', error);

    // Update video status to failed
    try {
      const db = adminFirestore();
      await db.collection('videos').doc(videoId).update({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Manifest build failed',
        updatedAt: Timestamp.now(),
      });

      // Log failure
      const body = await request.json().catch(() => ({}));
      await db.collection(`videos/${videoId}/logs`).add(cleanFirestoreData({
        videoId,
        step: 'manifest_build',
        status: 'failed',
        actor: body.userId || 'unknown',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          errorCode: 'MANIFEST_BUILD_FAILED',
          duration: Date.now() - startTime,
        },
        timestamp: Timestamp.now(),
      }));
    } catch (updateError) {
      console.error('[Manifest Build] Failed to update status:', updateError);
    }

    return NextResponse.json(
      { 
        error: 'Failed to build manifest',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

