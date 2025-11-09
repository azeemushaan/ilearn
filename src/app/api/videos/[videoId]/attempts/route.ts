import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminFirestore } from '@/lib/firebase/admin';
import { buildProgressDocId } from '@/lib/progress/utils';

const toLoggableError = (error: unknown) =>
  error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { message: String(error) };

export async function POST(
  request: NextRequest,
  ctx: { params: { videoId: string } | Promise<{ videoId: string }> }
) {
  try {
    const awaitedParams = ctx.params instanceof Promise ? await ctx.params : ctx.params;
    const { videoId } = awaitedParams;

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(token);
    } catch (error) {
      console.error('[attempts] Token verification failed', toLoggableError(error));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const studentId = decoded.uid;
    const body = await request.json();
    const {
      assignmentId = null,
      questionId,
      segmentId,
      segmentIndex,
      chosenIndex,
      isCorrect,
      watchPct = 0,
    } = body ?? {};

    if (!questionId || !segmentId || typeof segmentIndex !== 'number' || typeof chosenIndex !== 'number') {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }

    const db = adminFirestore();
    const progressDocId = buildProgressDocId(studentId, assignmentId, videoId);
    const progressRef = db.collection('progress').doc(progressDocId);

    const now = Timestamp.now();
    let progressSnap = await progressRef.get();
    if (!progressSnap.exists) {
      await progressRef.set({
        studentId,
        assignmentId,
        videoId,
        watchPct: 0,
        score: 0,
        attempts: 0,
        correctAttempts: 0,
        segmentsCompleted: [],
        questionHistory: {},
        lastVerifiedTimeSec: 0,
        createdAt: now,
        updatedAt: now,
      });
      progressSnap = await progressRef.get();
    }

    const progressData = progressSnap.data() || {};
    const segmentsCompleted: string[] = progressData.segmentsCompleted || [];
    const questionHistory: Record<string, string[]> = progressData.questionHistory || {};

    if (segmentsCompleted.length < segmentIndex) {
      return NextResponse.json({ error: 'Segment locked. Complete prior checkpoints first.' }, { status: 409 });
    }

    const segmentRef = db.collection(`videos/${videoId}/segments`).doc(segmentId);
    const segmentSnap = await segmentRef.get();
    if (!segmentSnap.exists) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    const canonicalIndex = segmentSnap.data()?.segmentIndex;
    if (typeof canonicalIndex === 'number' && canonicalIndex !== segmentIndex) {
      return NextResponse.json({ error: 'Segment mismatch' }, { status: 400 });
    }

    const attemptRef = await db.collection('attempts').add({
      studentId,
      assignmentId,
      questionId,
      segmentId,
      videoId,
      segmentIndex,
      chosenIndex,
      isCorrect,
      ts: now,
    });

    const nextAttempts = (progressData.attempts || 0) + 1;
    const nextCorrectAttempts = (progressData.correctAttempts || 0) + (isCorrect ? 1 : 0);
    const nextScore = nextAttempts > 0 ? Math.round((nextCorrectAttempts / nextAttempts) * 100) : 0;
    const existingHistory = questionHistory[segmentId] || [];
    const nextHistory = Array.from(new Set([...existingHistory, questionId]));

    questionHistory[segmentId] = nextHistory;

    const sanitizedWatchPct = Math.max(progressData.watchPct || 0, Math.min(Math.max(watchPct, 0), 100));

    await progressRef.update({
      attempts: nextAttempts,
      correctAttempts: nextCorrectAttempts,
      score: nextScore,
      watchPct: sanitizedWatchPct,
      questionHistory,
      lastActivityAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      attemptId: attemptRef.id,
      progressSnapshot: {
        docId: progressDocId,
        segmentsCompleted,
        questionHistory,
        lastVerifiedTimeSec: progressData.lastVerifiedTimeSec || 0,
        watchPct: sanitizedWatchPct,
        score: nextScore,
        attempts: nextAttempts,
        correctAttempts: nextCorrectAttempts,
      },
    });
  } catch (error) {
    console.error('[attempts] Unexpected error', toLoggableError(error));
    return NextResponse.json({ error: 'Failed to record attempt' }, { status: 500 });
  }
}
