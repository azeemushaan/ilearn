import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { cleanFirestoreData } from '@/lib/utils';
import { parseSRT, parseVTT } from '@/lib/youtube/segmentation';

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB

/**
 * Upload SRT/VTT caption file
 * POST /api/videos/[videoId]/captions/upload
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ videoId: string }> | { videoId: string } }
) {
  const startTime = Date.now();
  
  try {
    const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
    const { videoId } = params;

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;
    const language = formData.get('language') as string || 'en';

    if (!file) {
      return NextResponse.json(
        { error: 'Caption file required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB` },
        { status: 400 }
      );
    }

    // Check file extension
    const fileName = file.name.toLowerCase();
    const isVTT = fileName.endsWith('.vtt');
    const isSRT = fileName.endsWith('.srt');

    if (!isVTT && !isSRT) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload .srt or .vtt file' },
        { status: 400 }
      );
    }

    const format = isVTT ? 'vtt' : 'srt';

    // Read file content
    const content = await file.text();

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Empty caption file' },
        { status: 400 }
      );
    }

    // Validate and parse captions
    let cues;
    try {
      cues = format === 'vtt' ? parseVTT(content) : parseSRT(content);
    } catch (parseError) {
      return NextResponse.json(
        { 
          error: 'Invalid caption file format',
          message: parseError instanceof Error ? parseError.message : 'Failed to parse caption file'
        },
        { status: 400 }
      );
    }

    if (cues.length === 0) {
      return NextResponse.json(
        { error: 'No caption cues found in file' },
        { status: 400 }
      );
    }

    // Validate timestamp integrity (no overlaps, chronological order)
    for (let i = 0; i < cues.length - 1; i++) {
      const current = cues[i];
      const next = cues[i + 1];

      // Check if times are valid
      if (current.endTime <= current.startTime) {
        return NextResponse.json(
          { error: `Invalid timestamp in cue ${i + 1}: end time must be after start time` },
          { status: 400 }
        );
      }

      // Check if overlapping
      if (current.endTime > next.startTime) {
        return NextResponse.json(
          { error: `Overlapping timestamps detected between cue ${i + 1} and ${i + 2}` },
          { status: 400 }
        );
      }
    }

    // Store in Firestore
    const db = adminFirestore();
    const videoRef = db.collection('videos').doc(videoId);
    const videoDoc = await videoRef.get();

    if (!videoDoc.exists) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Update video status to processing
    await videoRef.update({
      status: 'processing',
      updatedAt: Timestamp.now(),
    });

    // Log processing start
    await db.collection(`videos/${videoId}/logs`).add(cleanFirestoreData({
      videoId,
      step: 'caption_fetch',
      status: 'started',
      actor: userId,
      metadata: {
        source: 'srt',
        language,
        format,
        fileSize: file.size,
        cueCount: cues.length,
      },
      timestamp: Timestamp.now(),
    }));

    // Store caption content
    await videoRef.update({
      captionSource: 'srt',
      captionLanguage: language,
      hasCaptions: true,
      status: 'not_ready', // Back to not_ready, waiting for next step
      errorMessage: null,
      updatedAt: Timestamp.now(),
    });

    await db.collection(`videos/${videoId}/captions`).doc('current').set({
      content,
      language,
      source: 'srt',
      format,
      fileName: file.name,
      fileSize: file.size,
      cueCount: cues.length,
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
        source: 'srt',
        language,
        format,
        cueCount: cues.length,
        duration,
      },
      timestamp: Timestamp.now(),
    }));

    console.log('[Caption Upload] Success:', {
      videoId,
      format,
      language,
      cueCount: cues.length,
      fileSize: file.size,
      duration,
    });

    return NextResponse.json({
      success: true,
      captionTrack: {
        language,
        format,
        cueCount: cues.length,
      },
      duration,
    });
  } catch (error) {
    const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
    const { videoId } = params;
    
    console.error('[Caption Upload] Failed:', error);

    // Update video status to failed
    try {
      const db = adminFirestore();
      await db.collection('videos').doc(videoId).update({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Caption upload failed',
        updatedAt: Timestamp.now(),
      });

      // Log failure
      const formData = await request.formData().catch(() => new FormData());
      const userId = formData.get('userId') as string || 'unknown';
      
      await db.collection(`videos/${videoId}/logs`).add(cleanFirestoreData({
        videoId,
        step: 'caption_fetch',
        status: 'failed',
        actor: userId,
        metadata: {
          source: 'srt',
          error: error instanceof Error ? error.message : String(error),
          errorCode: 'CAPTION_UPLOAD_FAILED',
          duration: Date.now() - startTime,
        },
        timestamp: Timestamp.now(),
      }));
    } catch (updateError) {
      console.error('[Caption Upload] Failed to update status:', updateError);
    }

    return NextResponse.json(
      { 
        error: 'Failed to upload captions',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

