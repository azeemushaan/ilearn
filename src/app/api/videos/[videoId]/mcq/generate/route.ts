import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { cleanFirestoreData } from '@/lib/utils';
import { generateMcq } from '@/ai/flows/generate-mcq';

/**
 * Generate MCQs for all segments
 * POST /api/videos/[videoId]/mcq/generate
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
    const { targetLanguage = 'en', userId } = body;

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

    // Check if segments exist
    const segmentsSnapshot = await db
      .collection(`videos/${videoId}/segments`)
      .orderBy('segmentIndex')
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
      mcqLanguage: targetLanguage,
      updatedAt: Timestamp.now(),
    });

    // Log processing start
    await db.collection(`videos/${videoId}/logs`).add(cleanFirestoreData({
      videoId,
      step: 'mcq_generate',
      status: 'started',
      actor: userId,
      metadata: {
        targetLanguage,
        segmentCount: segmentsSnapshot.size,
      },
      timestamp: Timestamp.now(),
    }));

    let totalQuestionsGenerated = 0;
    const failedSegments: string[] = [];

    // Generate MCQs for each segment
    for (const segmentDoc of segmentsSnapshot.docs) {
      const segmentData = segmentDoc.data();

      try {
        const mcqResult = await generateMcq({
          transcriptChunk: segmentData.textChunk,
          videoTitle: videoData.title,
          chapterName: `Segment ${segmentData.segmentIndex + 1}`,
          gradeBand: '1-8',
          locale: targetLanguage,
          difficultyTarget: segmentData.difficulty,
          coachId: videoData.coachId,
          videoId,
        });

        const questions = Array.isArray(mcqResult?.questions) ? mcqResult.questions : [];

        if (questions.length > 0) {
          // Delete existing questions for this segment
          const existingQuestions = await db
            .collection(`videos/${videoId}/segments/${segmentDoc.id}/questions`)
            .get();

          const deleteBatch = db.batch();
          existingQuestions.docs.forEach(q => deleteBatch.delete(q.ref));
          await deleteBatch.commit();

          // Store new questions
          const questionBatch = db.batch();
          
          questions.forEach((question, questionIndex) => {
            const questionRef = db
              .collection(`videos/${videoId}/segments/${segmentDoc.id}/questions`)
              .doc();

            questionBatch.set(questionRef, {
              segmentId: segmentDoc.id,
              videoId,
              coachId: videoData.coachId,
              difficulty: question.difficulty || segmentData.difficulty,
              stem: question.stem,
              options: Array.isArray(question.options) ? question.options : [],
              correctIndex: question.correctIndex,
              rationale: question.rationale,
              tags: Array.isArray(question.tags) ? question.tags : [],
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
              sequenceIndex: questionIndex,
            });
          });

          await questionBatch.commit();

          // Update segment question count
          await segmentDoc.ref.update({
            questionCount: questions.length,
            updatedAt: Timestamp.now(),
          });

          totalQuestionsGenerated += questions.length;
        } else {
          failedSegments.push(segmentDoc.id);
          console.warn('[MCQ Generate] No questions generated for segment:', {
            segmentId: segmentDoc.id,
            segmentIndex: segmentData.segmentIndex,
          });
        }
      } catch (mcqError) {
        failedSegments.push(segmentDoc.id);
        console.error('[MCQ Generate] Failed for segment:', {
          segmentId: segmentDoc.id,
          error: mcqError,
        });
      }
    }

    // Update video status
    await videoRef.update({
      status: 'not_ready', // Waiting for manifest build
      updatedAt: Timestamp.now(),
    });

    // Log success
    const duration = Date.now() - startTime;
    await db.collection(`videos/${videoId}/logs`).add(cleanFirestoreData({
      videoId,
      step: 'mcq_generate',
      status: 'completed',
      actor: userId,
      metadata: {
        targetLanguage,
        totalQuestions: totalQuestionsGenerated,
        failedSegments: failedSegments.length,
        duration,
      },
      timestamp: Timestamp.now(),
    }));

    console.log('[MCQ Generate] Success:', {
      videoId,
      totalQuestions: totalQuestionsGenerated,
      failedSegments: failedSegments.length,
      duration,
    });

    return NextResponse.json({
      success: true,
      questionsGenerated: totalQuestionsGenerated,
      failedSegments: failedSegments.length,
      duration,
    });
  } catch (error) {
    const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
    const { videoId } = params;
    
    console.error('[MCQ Generate] Failed:', error);

    // Update video status to failed
    try {
      const db = adminFirestore();
      await db.collection('videos').doc(videoId).update({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'MCQ generation failed',
        updatedAt: Timestamp.now(),
      });

      // Log failure
      const body = await request.json().catch(() => ({}));
      await db.collection(`videos/${videoId}/logs`).add(cleanFirestoreData({
        videoId,
        step: 'mcq_generate',
        status: 'failed',
        actor: body.userId || 'unknown',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          errorCode: 'MCQ_GENERATE_FAILED',
          duration: Date.now() - startTime,
        },
        timestamp: Timestamp.now(),
      }));
    } catch (updateError) {
      console.error('[MCQ Generate] Failed to update status:', updateError);
    }

    return NextResponse.json(
      { 
        error: 'Failed to generate MCQs',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

