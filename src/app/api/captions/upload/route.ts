import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminFirestore, adminStorage } from '@/lib/firebase/admin';
import { parseSRT, parseVTT } from '@/lib/youtube/segmentation';

const SUPPORTED_FORMATS = ['srt', 'vtt'] as const;
type CaptionFormat = (typeof SUPPORTED_FORMATS)[number];

const sanitizeFilename = (filename: string) =>
  filename.replace(/[^a-zA-Z0-9._-]+/g, '_');

const inferFormat = (
  explicitFormat: unknown,
  filename: string | undefined,
  contentType: string | undefined
): CaptionFormat => {
  if (explicitFormat === 'vtt') return 'vtt';
  if (explicitFormat === 'srt') return 'srt';

  const lowerName = (filename ?? '').toLowerCase();
  if (lowerName.endsWith('.vtt')) return 'vtt';
  if (lowerName.endsWith('.srt')) return 'srt';

  const lowerType = (contentType ?? '').toLowerCase();
  if (lowerType.includes('text/vtt') || lowerType.includes('webvtt')) {
    return 'vtt';
  }

  return 'srt';
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const coachId = formData.get('coachId');
    const videoId = formData.get('videoId');
    const fileField = formData.get('file') ?? formData.get('caption');
    const formatField = formData.get('format');

    if (typeof coachId !== 'string' || coachId.trim() === '') {
      return NextResponse.json(
        { error: 'coachId is required' },
        { status: 400 }
      );
    }

    if (typeof videoId !== 'string' || videoId.trim() === '') {
      return NextResponse.json(
        { error: 'videoId is required' },
        { status: 400 }
      );
    }

    if (!fileField || typeof fileField !== 'object' || !('arrayBuffer' in fileField)) {
      return NextResponse.json(
        { error: 'A caption file must be provided as form-data' },
        { status: 400 }
      );
    }

    const file = fileField as File;
    const originalName = 'name' in file ? file.name : 'captions.txt';
    const sanitizedName = sanitizeFilename(originalName || 'captions.txt');
    const contentType = 'type' in file ? file.type : 'text/plain';
    const format = inferFormat(formatField, sanitizedName, contentType);

    if (!SUPPORTED_FORMATS.includes(format)) {
      return NextResponse.json(
        { error: `Unsupported caption format: ${format}` },
        { status: 400 }
      );
    }

    const db = adminFirestore();
    const videoRef = db.collection('videos').doc(videoId);
    const videoSnap = await videoRef.get();

    if (!videoSnap.exists) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const videoData = videoSnap.data();
    if (!videoData || videoData.coachId !== coachId) {
      return NextResponse.json(
        { error: 'Coach does not have access to this video' },
        { status: 403 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);
    const captionContent = rawBuffer.toString('utf8');

    const cues = format === 'vtt'
      ? parseVTT(captionContent)
      : parseSRT(captionContent);

    if (!Array.isArray(cues) || cues.length === 0) {
      return NextResponse.json(
        { error: 'Failed to parse any cues from the uploaded caption file' },
        { status: 400 }
      );
    }

    const storage = adminStorage();
    const bucket = storage.bucket();
    const timestamp = Date.now();
    const storagePath = `captions/${coachId}/${videoId}/${timestamp}-${sanitizedName}`;
    const storageFile = bucket.file(storagePath);

    await storageFile.save(rawBuffer, {
      contentType: contentType || 'text/plain',
    });

    const now = Timestamp.now();
    await videoRef.update({
      transcript: {
        storagePath,
        format,
        originalFilename: sanitizedName,
        cueCount: cues.length,
        uploadedAt: now,
        updatedAt: now,
      },
      hasCaptions: true,
      chaptersOnly: false,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      videoId,
      coachId,
      storagePath,
      format,
      cueCount: cues.length,
      message: 'Captions uploaded successfully',
    });
  } catch (error: any) {
    console.error('captionsUpload.error', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to upload captions',
      },
      { status: 500 }
    );
  }
}
