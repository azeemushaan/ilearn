import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { 
  parseSRT, 
  parseVTT, 
  segmentTranscript, 
  createUniformSegments 
} from '@/lib/youtube/segmentation';
import { generateMcq, McqGenerationError } from '@/ai/flows/generate-mcq';

const toLoggableError = (error: unknown) =>
  error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { message: String(error) };

export async function POST(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { videoId } = params;
    const body = await request.json();
    const { 
      captionContent, 
      captionFormat = 'srt', 
      forceReprocess = false 
    } = body;

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

    // Check if already processed
    if (videoData.status === 'ready' && !forceReprocess) {
      return NextResponse.json({
        success: true,
        message: 'Video already processed',
        videoId,
        status: 'ready',
      });
    }

    // Update status to processing
    await videoRef.update({
      status: 'processing',
      updatedAt: Timestamp.now(),
    });

    try {
      let segments;

      // Strategy 1: Use provided captions
      if (captionContent) {
        const cues = captionFormat === 'vtt' 
          ? parseVTT(captionContent)
          : parseSRT(captionContent);

        segments = segmentTranscript(cues, {
          minDuration: 30,
          maxDuration: 60,
          preferredDuration: 45,
        });

        await videoRef.update({
          hasCaptions: true,
          chaptersOnly: false,
        });
      } 
      // Strategy 2: Fallback to uniform segments
      else {
        segments = createUniformSegments(videoData.duration, 45);
        
        await videoRef.update({
          hasCaptions: false,
          chaptersOnly: true, // Using uniform segments as fallback
        });
      }

      if (segments.length === 0) {
        throw new Error('No segments generated');
      }

      // Store segments and generate questions
      const segmentRefs: string[] = [];

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        
        // Create segment document
        const segmentRef = await db.collection(`videos/${videoId}/segments`).add({
          videoId,
          tStartSec: segment.tStartSec,
          tEndSec: segment.tEndSec,
          textChunk: segment.textChunk,
          textChunkHash: segment.textChunkHash,
          summary: segment.textChunk.substring(0, 100) + '...',
          difficulty: i < segments.length / 3 ? 'easy' : i < (2 * segments.length) / 3 ? 'medium' : 'hard',
          questionCount: 0,
          createdAt: Timestamp.now(),
        });

        segmentRefs.push(segmentRef.id);

        // Generate MCQs for this segment
        const mcqResult = await generateMcq({
          transcriptChunk: segment.textChunk,
          videoTitle: videoData.title,
          chapterName: `Segment ${i + 1}`,
          gradeBand: '1-8', // Default for now
          locale: 'en',
          difficultyTarget: i < segments.length / 3 ? 'easy' : i < (2 * segments.length) / 3 ? 'medium' : 'hard',
        });

        // Store questions
        let questionCount = 0;
        for (const question of mcqResult.questions) {
          await db.collection(`videos/${videoId}/segments/${segmentRef.id}/questions`).add({
            segmentId: segmentRef.id,
            videoId,
            stem: question.stem,
            options: question.options,
            correctIndex: question.correctIndex,
            rationale: question.rationale,
            tags: question.tags,
            difficulty: question.difficulty,
            createdAt: Timestamp.now(),
          });
          questionCount++;
        }

        // Update segment question count
        await segmentRef.update({
          questionCount,
        });
      }

      // Update video status to ready
      await videoRef.update({
        status: 'ready',
        segmentCount: segments.length,
        updatedAt: Timestamp.now(),
      });

      return NextResponse.json({
        success: true,
        message: 'Video processed successfully',
        videoId,
        segmentsCreated: segments.length,
        segmentRefs,
        status: 'ready',
      });
    } catch (error: any) {
      // Update video status to error
      await videoRef.update({
        status: 'error',
        updatedAt: Timestamp.now(),
      });

      console.error('prepareVideo.processFailure', {
        videoId,
        error: toLoggableError(error),
      });

      throw error;
    }
  } catch (error: any) {
    const status = error instanceof McqGenerationError ? 502 : 500;

    console.error('prepareVideoRoute.error', {
      videoId: params.videoId,
      error: toLoggableError(error),
      status,
    });
    return NextResponse.json(
      { error: error.message || 'Failed to prepare video' },
      { status }
    );
  }
}
