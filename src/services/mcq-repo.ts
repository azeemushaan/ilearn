// src/services/mcq-repo.ts

import { adminFirestore } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { cleanFirestoreData } from '@/lib/utils';
import { MCQVersioned, Segment, Attempt } from '@/types/video';
import { ID, MCQState } from '@/types/common';

const db = adminFirestore();

// MCQ operations
export async function getLatestMCQForSegment(segmentId: ID): Promise<MCQVersioned | null> {
  const mcqRef = db.collection('mcqs')
    .where('segmentId', '==', segmentId)
    .orderBy('version', 'desc')
    .limit(1);

  const snapshot = await mcqRef.get();
  if (snapshot.empty) return null;

  const data = snapshot.docs[0].data();
  return {
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
    publishedAt: data.publishedAt?.toDate?.()?.toISOString() || data.publishedAt,
  } as MCQVersioned;
}

export async function getMCQByIdAndVersion(mcqId: ID, version: number): Promise<MCQVersioned | null> {
  const mcqRef = db.collection('mcqs').doc(`${mcqId}_v${version}`);
  const doc = await mcqRef.get();
  if (!doc.exists) return null;

  const data = doc.data()!;
  return {
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
    publishedAt: data.publishedAt?.toDate?.()?.toISOString() || data.publishedAt,
  } as MCQVersioned;
}

export async function getMCQHistory(mcqId: ID): Promise<MCQVersioned[]> {
  const mcqRef = db.collection('mcqs')
    .where('mcqId', '==', mcqId)
    .orderBy('version', 'desc');

  const snapshot = await mcqRef.get();
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      publishedAt: data.publishedAt?.toDate?.()?.toISOString() || data.publishedAt,
    } as MCQVersioned;
  });
}

export async function listVideoMCQs(videoId: ID, excludeMcqId?: ID): Promise<MCQVersioned[]> {
  let query = db.collection('mcqs')
    .where('videoId', '==', videoId)
    .where('state', 'in', ['draft', 'published']);

  if (excludeMcqId) {
    query = query.where('mcqId', '!=', excludeMcqId);
  }

  const snapshot = await query.get();

  // Group by mcqId and get latest version
  const mcqMap = new Map<string, MCQVersioned>();
  snapshot.docs.forEach(doc => {
    const data = doc.data() as MCQVersioned;
    const existing = mcqMap.get(data.mcqId);
    if (!existing || data.version > existing.version) {
      mcqMap.set(data.mcqId, {
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || data.publishedAt,
      });
    }
  });

  return Array.from(mcqMap.values());
}

export async function saveMCQDraft(mcq: MCQVersioned): Promise<MCQVersioned> {
  const mcqRef = db.collection('mcqs').doc(`${mcq.mcqId}_v${mcq.version}`);

  const data = {
    ...cleanFirestoreData(mcq),
    createdAt: Timestamp.fromDate(new Date(mcq.createdAt)),
    updatedAt: Timestamp.fromDate(new Date(mcq.updatedAt)),
    publishedAt: mcq.publishedAt ? Timestamp.fromDate(new Date(mcq.publishedAt)) : null,
  };

  await mcqRef.set(data, { merge: true });

  return mcq;
}

export async function publishMCQ(mcqId: ID, version: number, actorId: ID): Promise<MCQVersioned> {
  const mcqRef = db.collection('mcqs').doc(`${mcqId}_v${version}`);
  const doc = await mcqRef.get();
  if (!doc.exists) throw new Error('MCQ not found');

  const data = doc.data()!;
  const updatedData = {
    ...data,
    state: MCQState.Published,
    publishedAt: Timestamp.now(),
    updatedBy: actorId,
    updatedAt: Timestamp.now(),
  };

  await mcqRef.update(updatedData);

  return {
    ...updatedData,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
    updatedAt: updatedData.updatedAt.toDate().toISOString(),
    publishedAt: updatedData.publishedAt.toDate().toISOString(),
  } as MCQVersioned;
}

export async function unpublishMCQ(mcqId: ID, version: number, actorId: ID): Promise<void> {
  const mcqRef = db.collection('mcqs').doc(`${mcqId}_v${version}`);
  const doc = await mcqRef.get();
  if (!doc.exists) throw new Error('MCQ not found');

  await mcqRef.update({
    state: MCQState.Draft,
    publishedAt: null,
    updatedBy: actorId,
    updatedAt: Timestamp.now(),
  });
}

export async function createMCQFork(mcqId: ID, fromVersion: number, actorId: ID): Promise<MCQVersioned> {
  // Get the source MCQ
  const sourceMcq = await getMCQByIdAndVersion(mcqId, fromVersion);
  if (!sourceMcq) throw new Error('Source MCQ not found');

  // Create new version
  const newVersion = fromVersion + 1;
  const newMcq: MCQVersioned = {
    ...sourceMcq,
    version: newVersion,
    state: MCQState.Draft,
    createdBy: actorId,
    updatedBy: actorId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: undefined,
  };

  return await saveMCQDraft(newMcq);
}

// Segment operations
export async function getSegment(segmentId: ID): Promise<Segment | null> {
  const segmentRef = db.collection('segments').doc(segmentId);
  const doc = await segmentRef.get();
  if (!doc.exists) return null;

  return doc.data() as Segment;
}

export async function getVideoSegments(videoId: ID): Promise<Segment[]> {
  const segmentsRef = db.collection('segments')
    .where('videoId', '==', videoId)
    .orderBy('tStartSec');

  const snapshot = await segmentsRef.get();
  return snapshot.docs.map(doc => doc.data() as Segment);
}

// Attempt operations
export async function getAttemptsCount(mcqId: ID, version: number): Promise<number> {
  const attemptsRef = db.collection('attempts')
    .where('mcqId', '==', mcqId)
    .where('mcqVersion', '==', version);

  const snapshot = await attemptsRef.get();
  return snapshot.size;
}

// Audit logging
export async function logAudit(audit: {
  actorId: ID;
  action: string;
  mcqId?: ID;
  versionFrom?: number;
  versionTo?: number;
  videoId?: ID;
  segmentId?: ID;
  message?: string;
}): Promise<void> {
  const auditRef = db.collection('audit').doc();
  await auditRef.set(cleanFirestoreData({
    ...audit,
    at: Timestamp.now(),
  }));
}
