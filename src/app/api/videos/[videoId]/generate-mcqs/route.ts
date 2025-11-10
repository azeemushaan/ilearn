import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { cleanFirestoreData } from '@/lib/utils';
import { generateMcqForSegment } from '@/lib/phase5/mcq';
import { NO_FALLBACK } from '@/lib/constants/phase5';

/**
 * Generate MCQs for all segments
 * POST /api/videos/[videoId]/generate-mcqs
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
    const outcomes: Array<{ segmentId: string; reason: string; log: string }> = [];

    // Generate MCQs for each segment
    const existingStems: string[] = [];

    for (const segmentDoc of segmentsSnapshot.docs) {
      const segmentData = segmentDoc.data();
      const textChunk: string = segmentData.textChunk ?? '';

      if (!textChunk && NO_FALLBACK) {
        outcomes.push({ segmentId: segmentDoc.id, reason: 'INSUFFICIENT_CONTEXT', log: 'MCQ:EMPTY reason=NO_TEXT' });
        await segmentDoc.ref.update({ questionCount: 0, updatedAt: Timestamp.now() });
        continue;
      }

      const outcome = generateMcqForSegment(
        {
          segmentId: segmentDoc.id,
          title: segmentData.title || `Segment ${segmentData.segmentIndex + 1}`,
          text: textChunk,
          tStartSec: segmentData.tStartSec,
          tEndSec: segmentData.tEndSec,
          language: segmentData.language || targetLanguage,
        },
        existingStems,
        targetLanguage
      );

      outcomes.push({ segmentId: segmentDoc.id, reason: outcome.reason, log: outcome.log });

      const existingQuestions = await db
        .collection(`videos/${videoId}/segments/${segmentDoc.id}/questions`)
        .get();

      if (!existingQuestions.empty) {
        const deleteBatch = db.batch();
        existingQuestions.docs.forEach(q => deleteBatch.delete(q.ref));
        await deleteBatch.commit();
      }

      if (outcome.mcqs.length === 0) {
        await segmentDoc.ref.update({ questionCount: 0, updatedAt: Timestamp.now() });
        continue;
      }

      const mcq = outcome.mcqs[0];
      const questionRef = db.collection(`videos/${videoId}/segments/${segmentDoc.id}/questions`).doc(mcq.questionId);
      await questionRef.set({
        segmentId: segmentDoc.id,
        videoId,
        coachId: videoData.coachId,
        stem: mcq.stem,
        options: mcq.options,
        correctIndex: mcq.correctIndex,
        rationale: mcq.rationale,
        support: mcq.support,
        language: mcq.language,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        sequenceIndex: 0,
      });

      await segmentDoc.ref.update({ questionCount: 1, updatedAt: Timestamp.now() });

      totalQuestionsGenerated += 1;
      existingStems.push(mcq.stem);
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
        outcomes,
        duration,
      },
      timestamp: Timestamp.now(),
    }));

    console.log('[MCQ Generate] Success:', {
      videoId,
      totalQuestions: totalQuestionsGenerated,
      outcomes,
      duration,
    });

    return NextResponse.json({
      success: true,
      questionsGenerated: totalQuestionsGenerated,
      outcomes,
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

