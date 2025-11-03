import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { 
  parseSRT, 
  parseVTT, 
  segmentTranscript, 
  createUniformSegments 
} from '@/lib/youtube/segmentation';
import { generateMcq } from '@/ai/flows/generate-mcq';

export async function POST(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  const { videoId } = params;

  try {
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
        errorMessage: videoData.errorMessage ?? null,
      });
    }

    // Update status to processing
    await videoRef.update({
      status: 'processing',
      errorMessage: null,
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
        const difficulty = i < segments.length / 3 ? 'easy' : i < (2 * segments.length) / 3 ? 'medium' : 'hard';

        // Generate MCQs for this segment. Any failure should abort processing.
        const mcqResult = await generateMcq({
          transcriptChunk: segment.textChunk,
          videoTitle: videoData.title,
          chapterName: `Segment ${i + 1}`,
          gradeBand: '1-8', // Default for now
          locale: 'en',
          difficultyTarget: difficulty,
        });

        const questions = mcqResult.questions ?? [];

        // Create segment document only after MCQs are generated successfully
        const segmentRef = db.collection(`videos/${videoId}/segments`).doc();
        await segmentRef.set({
          videoId,
          tStartSec: segment.tStartSec,
          tEndSec: segment.tEndSec,
          textChunk: segment.textChunk,
          textChunkHash: segment.textChunkHash,
          summary: segment.textChunk.substring(0, 100) + '...',
          difficulty,
          questionCount: questions.length,
          createdAt: Timestamp.now(),
        });

        segmentRefs.push(segmentRef.id);

        if (questions.length > 0) {
          const questionCollection = db.collection(`videos/${videoId}/segments/${segmentRef.id}/questions`);
          const questionWrites = questions.map((question) =>
            questionCollection.add({
              segmentId: segmentRef.id,
              videoId,
              stem: question.stem,
              options: question.options,
              correctIndex: question.correctIndex,
              rationale: question.rationale,
              tags: question.tags,
              difficulty: question.difficulty,
              createdAt: Timestamp.now(),
            })
          );
          await Promise.all(questionWrites);
        }
      }

      // Update video status to ready
      await videoRef.update({
        status: 'ready',
        segmentCount: segments.length,
        errorMessage: null,
        updatedAt: Timestamp.now(),
      });

      return NextResponse.json({
        success: true,
        message: 'Video processed successfully',
        videoId,
        segmentsCreated: segments.length,
        segmentRefs,
        status: 'ready',
        errorMessage: null,
      });
    } catch (error: any) {
      // Update video status to error
      const errorMessage = error?.message || 'Failed to prepare video';
      await videoRef.update({
        status: 'error',
        errorMessage,
        updatedAt: Timestamp.now(),
      });

      throw error;
    }
  } catch (error: any) {
    console.error('Error preparing video:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to prepare video',
        status: 'error',
        videoId,
      },
      { status: 500 }
    );
  }
}
