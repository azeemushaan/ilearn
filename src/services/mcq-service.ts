// src/services/mcq-service.ts

import { zMCQVersioned } from "../schemas/mcq";
import { supportWithinSegment, isDuplicateMCQ } from "../validation/mcq-validators";
import {
  getAttemptsCount,
  getSegment,
  listVideoMCQs,
  saveMCQDraft,
  publishMCQ as publishMCQRepo,
  createMCQFork,
  logAudit,
  getMCQByIdAndVersion
} from "./mcq-repo";
import { MCQVersioned } from "../types/video";
import { ID } from "../types/common";

export async function validateMCQFull(mcq: any) {
  const parsed = zMCQVersioned.safeParse(mcq);
  const errors: {field:string; message:string}[] = [];
  const warnings: {field:string; message:string}[] = [];

  if (!parsed.success) {
    parsed.error.issues.forEach(i => errors.push({ field: i.path.join("."), message: i.message }));
    return { ok:false, errors, warnings };
  }

  const v = parsed.data;

  // Bounds check against segment
  const seg = await getSegment(v.segmentId);
  if (!seg) {
    errors.push({ field: "segmentId", message: "segment not found" });
    return { ok: false, errors, warnings };
  }

  if (!supportWithinSegment(v, seg)) {
    errors.push({ field: "support", message: "support lines must be within segment time range" });
  }

  // Dedup against other MCQs (latest versions)
  // TODO: Implement embedding service for dedup
  // const existing = await listVideoMCQs(v.videoId, { excludeMcqId: v.mcqId });
  // const dup = await isDuplicateMCQ(v, existing, cosine, embed);
  // if (dup) errors.push({ field: "stem", message: "duplicate with existing MCQ in this video" });

  return { ok: errors.length === 0, errors, warnings };
}

export async function publish(mcqId: ID, version: number, actorId: ID, reason?: string) {
  const attempts = await getAttemptsCount(mcqId, version);

  let publishedMcq: MCQVersioned;
  let publishedVersion: number;

  if (attempts === 0) {
    // In-place publish
    publishedMcq = await publishMCQRepo(mcqId, version, actorId);
    publishedVersion = version;
  } else {
    // Fork to v+1 draft, copy content, publish new version; old remains locked
    const fork = await createMCQFork(mcqId, version, actorId);
    const validated = await validateMCQFull(fork);
    if (!validated.ok) throw new Error("Cannot publish invalid MCQ");

    publishedMcq = await publishMCQRepo(mcqId, fork.version, actorId);
    publishedVersion = fork.version;
  }

  // Log the action
  await logAudit({
    actorId,
    action: 'mcq.publish',
    mcqId,
    versionFrom: version,
    versionTo: publishedVersion,
    message: reason,
  });

  return { mcq: publishedMcq, publishedVersion };
}

export async function createOrForkMCQ(
  segmentId: ID,
  videoId: ID,
  actorId: ID,
  payload: Pick<MCQVersioned, "language"|"stem"|"options"|"correctIndex"|"rationale"|"support"|"difficulty">,
  baseMcqId?: ID,
  fromVersion?: number
): Promise<MCQVersioned> {
  let mcq: MCQVersioned;

  if (baseMcqId && fromVersion) {
    // Fork existing MCQ
    mcq = await createMCQFork(baseMcqId, fromVersion, actorId);
    // Update with new payload
    mcq = {
      ...mcq,
      ...payload,
      updatedBy: actorId,
      updatedAt: new Date().toISOString(),
    };
  } else {
    // Create new MCQ
    const mcqId = `${segmentId}_mcq`; // Stable ID per segment
    const existing = await listVideoMCQs(videoId);
    const existingVersions = existing.filter(m => m.mcqId === mcqId);
    const nextVersion = existingVersions.length > 0
      ? Math.max(...existingVersions.map(m => m.version)) + 1
      : 1;

    mcq = {
      mcqId,
      version: nextVersion,
      state: 'draft' as const,
      segmentId,
      videoId,
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...payload,
    };
  }

  return await saveMCQDraft(mcq);
}

export async function updateMCQDraft(
  mcqId: ID,
  version: number,
  actorId: ID,
  patch: Partial<Pick<MCQVersioned, "stem"|"options"|"correctIndex"|"rationale"|"support"|"difficulty">>
): Promise<MCQVersioned> {
  const mcq = await getMCQByIdAndVersion(mcqId, version);
  if (!mcq) throw new Error('MCQ not found');
  if (mcq.state !== 'draft') throw new Error('Can only edit draft MCQs');

  const updatedMcq = {
    ...mcq,
    ...patch,
    updatedBy: actorId,
    updatedAt: new Date().toISOString(),
  };

  return await saveMCQDraft(updatedMcq);
}
