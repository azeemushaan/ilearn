import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, adminStorage } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { videoManifestSchema } from '@/lib/schemas';
import { notifyVideoReady, notifyStudentsVideoReady } from '@/lib/notifications/manager';
import { cleanFirestoreData } from '@/lib/utils';
import { buildVideoManifest } from '@/lib/videos/manifest';

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

    // Ensure we have segments before proceeding
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

    await videoRef.update({
      status: 'processing',
      updatedAt: Timestamp.now(),
    });

    await db.collection(`videos/${videoId}/logs`).add(cleanFirestoreData({
      videoId,
      step: 'manifest_build',
      status: 'started',
      actor: userId,
      metadata: {},
      timestamp: Timestamp.now(),
    }));

    const manifest = await buildVideoManifest(videoId, {
      ...videoData,
      status: 'ready',
    });
    const validatedManifest = videoManifestSchema.parse(manifest);

    let manifestUrl: string | null = null;
    try {
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      if (bucketName) {
        const bucket = adminStorage().bucket();
        const manifestPath = `manifests/${videoId}.json`;
        const file = bucket.file(manifestPath);
        await file.save(JSON.stringify(validatedManifest, null, 2), {
          contentType: 'application/json',
          metadata: {
            cacheControl: 'public, max-age=60',
          },
        });
        await file.makePublic();
        manifestUrl = `https://storage.googleapis.com/${bucketName}/${manifestPath}`;
      }
    } catch (cacheError) {
      console.error('[Manifest Build] Failed to cache manifest:', cacheError);
    }

    const updateData: Record<string, any> = {
      status: 'ready',
      manifestUrl,
      flags: {
        lockedReady: true,
      },
      errorMessage: null,
      updatedAt: Timestamp.now(),
      duration: validatedManifest.duration,
    };

    await videoRef.update(updateData);

    const duration = Date.now() - startTime;
    await db.collection(`videos/${videoId}/logs`).add(cleanFirestoreData({
      videoId,
      step: 'manifest_build',
      status: 'completed',
      actor: userId,
      metadata: {
        totalSegments: validatedManifest.totalSegments,
        totalQuestions: validatedManifest.totalQuestions,
        version: validatedManifest.version,
        ...(manifestUrl && { manifestUrl }),
        duration,
      },
      timestamp: Timestamp.now(),
    }));

    console.log('[Manifest Build] Success:', {
      videoId,
      duration,
      totalSegments: validatedManifest.totalSegments,
      totalQuestions: validatedManifest.totalQuestions,
    });

    try {
      await notifyVideoReady(videoData.coachId, videoId, videoData.title);
      const assignmentsSnapshot = await db
        .collection('assignments')
        .where('playlistId', '==', videoData.playlistId)
        .get();

      for (const assignmentDoc of assignmentsSnapshot.docs) {
        const studentIds: string[] = assignmentDoc.data().studentIds || [];
        if (studentIds.length > 0) {
          await notifyStudentsVideoReady(studentIds, videoId, videoData.title, assignmentDoc.id);
        }
      }
    } catch (notificationError) {
      console.error('[Manifest Build] Failed to send notifications:', notificationError);
    }

    return NextResponse.json({
      success: true,
      manifestUrl,
      totalSegments: validatedManifest.totalSegments,
      totalQuestions: validatedManifest.totalQuestions,
      duration,
    });
  } catch (error) {
    const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
    const { videoId } = params;

    console.error('[Manifest Build] Failed:', error);

    try {
      const db = adminFirestore();
      await db.collection('videos').doc(videoId).update({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Manifest build failed',
        updatedAt: Timestamp.now(),
      });

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

