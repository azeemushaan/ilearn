import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, adminStorage } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentReference } from 'firebase-admin/firestore';
import { 
  parseSRT, 
  parseVTT, 
  segmentTranscript, 
  createUniformSegments 
} from '@/lib/youtube/segmentation';
import { generateMcq } from '@/ai/flows/generate-mcq';

const toLoggableError = (error: unknown) =>
  error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { message: String(error) };

type CaptionFormat = 'srt' | 'vtt';

const inferFormatFromPath = (path: string): CaptionFormat =>
  path.toLowerCase().endsWith('.vtt') ? 'vtt' : 'srt';

export async function POST(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  const { videoId } = params;

  let lastSegmentContext: { index: number; difficulty: string } | null = null;

  const logSegmentError = (index: number, difficulty: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[prepareVideo] Segment processing failed', {
      videoId,
      segmentIndex: index,
      difficulty,
      message,
      stack,
    });
  };

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch (parseError) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('prepareVideoRoute.requestBodyParseFailed', parseError);
      }
    }

    const bodyCaptionContent = typeof body['captionContent'] === 'string'
      ? (body['captionContent'] as string)
      : null;
    const bodyCaptionFormat =
      body['captionFormat'] === 'vtt'
        ? 'vtt'
        : body['captionFormat'] === 'srt'
          ? 'srt'
          : null;
    const forceReprocess =
      typeof body['forceReprocess'] === 'boolean'
        ? (body['forceReprocess'] as boolean)
        : false;

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
    const coachId: string | undefined = videoData.coachId;

    if (!coachId) {
      return NextResponse.json(
        { error: 'Video is missing associated coach information' },
        { status: 400 }
      );
    }

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
      const segmentsCollection = db.collection(`videos/${videoId}/segments`);
      const existingSegments = await segmentsCollection.get();

      if (!existingSegments.empty) {
        for (const segmentDoc of existingSegments.docs) {
          const questionsSnap = await segmentDoc.ref.collection('questions').get();
          for (const questionDoc of questionsSnap.docs) {
            await questionDoc.ref.delete();
          }
          await segmentDoc.ref.delete();
        }
      }

      let captionContent = bodyCaptionContent;
      let captionFormat: CaptionFormat | null = bodyCaptionFormat;

      const transcriptInfo = (videoData.transcript ?? null) as
        | {
            storagePath?: string;
            format?: CaptionFormat;
          }
        | null;

      if (!captionContent && transcriptInfo?.storagePath) {
        try {
          const bucket = adminStorage().bucket();
          const file = bucket.file(transcriptInfo.storagePath);
          const [exists] = await file.exists();

          if (exists) {
            const [buffer] = await file.download();
            captionContent = buffer.toString('utf8');

            if (!captionFormat) {
              captionFormat = transcriptInfo?.format ?? inferFormatFromPath(transcriptInfo.storagePath);
            }
          } else {
            console.warn('prepareVideoRoute.transcriptMissing', {
              videoId,
              storagePath: transcriptInfo.storagePath,
            });
          }
        } catch (transcriptError) {
          console.error('prepareVideoRoute.transcriptDownloadFailed', {
            videoId,
            error: toLoggableError(transcriptError),
            storagePath: transcriptInfo?.storagePath,
          });
        }
      }

      let segments;
      let usedTranscript = false;

      if (captionContent) {
        const effectiveFormat: CaptionFormat = captionFormat === 'vtt' ? 'vtt' : 'srt';
        const cues = effectiveFormat === 'vtt'
          ? parseVTT(captionContent)
          : parseSRT(captionContent);

        const transcriptSegments = segmentTranscript(cues, {
          minDuration: 30,
          maxDuration: 60,
          preferredDuration: 45,
        });

        if (transcriptSegments.length > 0) {
          segments = transcriptSegments;
          usedTranscript = true;
        }
      }

      if (!segments || segments.length === 0) {
        segments = createUniformSegments(videoData.duration, 45);

        await videoRef.update({
          hasCaptions: false,
          chaptersOnly: true, // Using uniform segments as fallback
        });
      } else if (usedTranscript) {
        await videoRef.update({
          hasCaptions: true,
          chaptersOnly: false,
        });
      }

      if (segments.length === 0) {
        throw new Error('No segments generated');
      }

      // Store segments and generate questions
      const segmentRefs: string[] = [];
      const pendingSegmentWrites: Array<{
        index: number;
        difficulty: string;
        segmentRef: DocumentReference;
        segmentData: Record<string, unknown>;
        questionWrites: Array<{
          ref: DocumentReference;
          data: Record<string, unknown>;
        }>;
      }> = [];

      const summarize = (text: string) => {
        const normalized = text.trim();
        if (normalized.length <= 100) {
          return normalized;
        }

        return `${normalized.slice(0, 97)}...`;
      };

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const difficulty = i < segments.length / 3 ? 'easy' : i < (2 * segments.length) / 3 ? 'medium' : 'hard';
        lastSegmentContext = { index: i, difficulty };

        const mcqResult = await generateMcq({
          transcriptChunk: segment.textChunk,
          videoTitle: videoData.title,
          chapterName: `Segment ${i + 1}`,
          gradeBand: '1-8', // Default for now
          locale: 'en',
          difficultyTarget: difficulty,
          coachId,
          videoId,
        });

        const questions = Array.isArray(mcqResult?.questions) ? mcqResult!.questions : [];

        const segmentRef = db.collection(`videos/${videoId}/segments`).doc();
        const now = Timestamp.now();
        const segmentData = {
          videoId,
          coachId: videoData.coachId ?? null,
          segmentIndex: i,
          tStartSec: segment.tStartSec,
          tEndSec: segment.tEndSec,
          durationSec: Math.max(0, segment.tEndSec - segment.tStartSec),
          textChunk: segment.textChunk,
          textChunkHash: segment.textChunkHash,
          summary: summarize(segment.textChunk),
          difficulty,
          questionCount: questions.length,
          createdAt: now,
          updatedAt: now,
        };

        const questionWrites = questions.map((question, questionIndex) => ({
          ref: db.collection(`videos/${videoId}/segments/${segmentRef.id}/questions`).doc(),
          data: {
            segmentId: segmentRef.id,
            videoId,
            coachId: videoData.coachId ?? null,
            difficulty: question.difficulty ?? difficulty,
            stem: question.stem,
            options: Array.isArray(question.options) ? question.options : [],
            correctIndex: question.correctIndex,
            rationale: question.rationale,
            tags: Array.isArray(question.tags) ? question.tags : [],
            createdAt: now,
            updatedAt: now,
            sequenceIndex: questionIndex,
          },
        }));

        pendingSegmentWrites.push({
          index: i,
          difficulty,
          segmentRef,
          segmentData,
          questionWrites,
        });

        lastSegmentContext = null;
      }

      for (const pending of pendingSegmentWrites) {
        lastSegmentContext = { index: pending.index, difficulty: pending.difficulty };
        const batch = db.batch();
        batch.set(pending.segmentRef, pending.segmentData);
        pending.questionWrites.forEach(({ ref, data }) => {
          batch.set(ref, data);
        });

        try {
          await batch.commit();
        } catch (writeError) {
          logSegmentError(pending.index, pending.difficulty, writeError);
          throw writeError;
        }

        segmentRefs.push(pending.segmentRef.id);
        lastSegmentContext = null;
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
      const baseMessage = error?.message || 'Failed to prepare video';
      const contextualMessage = lastSegmentContext
        ? `Segment ${lastSegmentContext.index + 1} (${lastSegmentContext.difficulty}) ${baseMessage}`
        : baseMessage;

      if (lastSegmentContext) {
        logSegmentError(lastSegmentContext.index, lastSegmentContext.difficulty, error);
      }

      await videoRef.update({
        status: 'error',
        errorMessage: contextualMessage,
        updatedAt: Timestamp.now(),
      });

      const segmentIndex = lastSegmentContext?.index ?? null;

      if (error instanceof Error) {
        error.message = contextualMessage;
        (error as Error & { segmentIndex?: number | null }).segmentIndex = segmentIndex;
        throw error;
      }

      const contextualError = new Error(contextualMessage);
      (contextualError as Error & { segmentIndex?: number | null }).segmentIndex = segmentIndex;
      throw contextualError;
    }
  } catch (error: any) {
    const status = 500;
    const segmentIndex = typeof error?.segmentIndex === 'number' ? error.segmentIndex : null;
    console.error('prepareVideoRoute.error', {
      videoId: params.videoId,
      error: toLoggableError(error),
      status,
      segmentIndex,
    });
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to prepare video',
        errorMessage: error.message || 'Failed to prepare video',
        status: 'error',
        videoId,
        segmentIndex,
      },
      { status }
    );
  }
}
