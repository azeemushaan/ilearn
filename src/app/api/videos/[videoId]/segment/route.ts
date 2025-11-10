import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { cleanFirestoreData } from '@/lib/utils';
import { parseSRT, parseVTT } from '@/lib/youtube/segmentation';
import { segmentTranscriptPhase5, toFirestoreSegment, segmentTelemetrySummary, type CaptionCue } from '@/lib/phase5/segmentation';
import { SEG_MIN_CHARS } from '@/lib/constants/phase5';

/**
 * Segment transcript into chunks
 * POST /api/videos/[videoId]/segment
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

    // Check if captions exist
    const captionDoc = await db.collection(`videos/${videoId}/captions`).doc('current').get();

    if (!captionDoc.exists) {
      return NextResponse.json(
        { error: 'Captions not found. Please fetch captions first.' },
        { status: 400 }
      );
    }

    const captionData = captionDoc.data()!;

    // Update status to processing
    await videoRef.update({
      status: 'processing',
      updatedAt: Timestamp.now(),
    });

    // Log processing start
    await db.collection(`videos/${videoId}/logs`).add(cleanFirestoreData({
      videoId,
      step: 'segment',
      status: 'started',
      actor: userId,
      metadata: {
        segMinChars: SEG_MIN_CHARS,
      },
      timestamp: Timestamp.now(),
    }));

    // Parse captions
    console.log('[Segment] Caption data format:', captionData.format);
    console.log('[Segment] Caption content length:', captionData.content.length);
    console.log('[Segment] Caption content preview:', captionData.content.substring(0, 200));

    const parsedCues = captionData.format === 'vtt'
      ? parseVTT(captionData.content)
      : parseSRT(captionData.content);

    // Convert to CaptionCue format expected by segmentation
    const cues: CaptionCue[] = parsedCues.map(cue => ({
      tStartSec: cue.startTime,
      tEndSec: cue.endTime,
      text: cue.text,
    }));

    console.log('[Segment] Parsed cues count:', parsedCues.length, '-> converted to', cues.length);
    console.log('[Segment] First few cues:', cues.slice(0, 3));

    // Segment transcript
    const segmentationResult = segmentTranscriptPhase5(cues, {
      language: captionData.language || 'en',
      videoTopic: videoData.title,
    });

    console.log('[Segment] Segmentation telemetry:', segmentTelemetrySummary(segmentationResult));
    segmentationResult.logs.forEach(log => console.log('[Segment]', log));

    if (segmentationResult.segments.length === 0) {
      console.error('[Segment] No segments generated. Logs:', segmentationResult.logs);
      throw new Error('No segments generated from transcript');
    }

    // Delete existing segments
    const existingSegments = await db.collection(`videos/${videoId}/segments`).get();
    const batch = db.batch();
    
    existingSegments.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();

    // Store new segments
    const segmentRefs: string[] = [];
    const segmentBatch = db.batch();

    const keptSegments = segmentationResult.segments;

    for (let i = 0; i < keptSegments.length; i++) {
      const segment = keptSegments[i];
      const segmentRef = db.collection(`videos/${videoId}/segments`).doc(segment.segmentId);

      segmentBatch.set(segmentRef, {
        videoId,
        coachId: videoData.coachId,
        ...toFirestoreSegment(segment, i),
        summary: segment.text.slice(0, 100) + (segment.text.length > 100 ? '...' : ''),
        questionCount: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      segmentRefs.push(segmentRef.id);
    }

    await segmentBatch.commit();

    // Update video
    await videoRef.update({
      segmentCount: keptSegments.length,
      status: 'not_ready', // Waiting for MCQ generation
      updatedAt: Timestamp.now(),
    });

    // Log success
    const duration = Date.now() - startTime;
    await db.collection(`videos/${videoId}/logs`).add(cleanFirestoreData({
      videoId,
      step: 'segment',
      status: 'completed',
      actor: userId,
      metadata: {
        segmentCount: keptSegments.length,
        duration,
        skipped: segmentationResult.skipped.length,
      },
      timestamp: Timestamp.now(),
    }));

    console.log('[Segment] Success:', {
      videoId,
      segmentCount: keptSegments.length,
      duration,
    });

    return NextResponse.json({
      success: true,
      segmentCount: keptSegments.length,
      skipped: segmentationResult.skipped,
      logs: segmentationResult.logs,
      duration,
    });
  } catch (error) {
    const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
    const { videoId } = params;
    
    console.error('[Segment] Failed:', error);

    // Update video status to failed
    try {
      const db = adminFirestore();
      await db.collection('videos').doc(videoId).update({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Segmentation failed',
        updatedAt: Timestamp.now(),
      });

      // Log failure
      const body = await request.json().catch(() => ({}));
      const errorMessage = error instanceof Error ? error.message : String(error);
      await db.collection(`videos/${videoId}/logs`).add(cleanFirestoreData({
        videoId,
        step: 'segment',
        status: 'failed',
        actor: body.userId || 'unknown',
        metadata: {
          error: errorMessage,
          errorCode: 'SEGMENT_FAILED',
          duration: Date.now() - startTime,
        },
        timestamp: Timestamp.now(),
      }));
    } catch (updateError) {
      console.error('[Segment] Failed to update status:', updateError);
    }

    return NextResponse.json(
      { 
        error: 'Failed to segment transcript',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

