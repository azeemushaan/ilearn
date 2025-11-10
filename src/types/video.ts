// src/types/video.ts

import { ID, ISO639_1, SupportLine, MCQState, SkipReason } from "./common";

export interface Segment {
  segmentId: ID;
  videoId: ID;
  title: string;           // 1–5 words
  language: ISO639_1;
  tStartSec: number;
  tEndSec: number;
  text: string;            // cleaned transcript slice (might be long)
  hasMCQ: boolean;         // convenience flag for player
}

export interface MCQOption {
  id: ID;                  // stable in-editor for drag/drop
  text: string;
}

export interface MCQVersioned {
  mcqId: ID;               // stable across versions (segment-level key)
  version: number;         // v1, v2, ...
  state: MCQState;         // draft | published | locked
  segmentId: ID;
  videoId: ID;
  language: ISO639_1;      // target language for the MCQ
  stem: string;
  options: MCQOption[];    // 2–4 options allowed; 4 recommended
  correctIndex: number;    // 0-based index into options
  rationale?: string;      // short, optional
  support: SupportLine[];  // must be within the segment timerange
  difficulty?: "Easy" | "Medium" | "Hard";
  createdBy: ID;           // coach/teacher
  updatedBy: ID;           // coach/teacher
  createdAt: string;       // ISO
  updatedAt: string;       // ISO
  publishedAt?: string;    // ISO when state=published
  dedupVector?: number[];  // optional cached embedding for dedup checks
}

export interface Attempt {
  attemptId: ID;
  studentId: ID;
  videoId: ID;
  segmentId: ID;
  mcqId: ID;
  mcqVersion: number;      // frozen reference
  chosenIndex: number;
  isCorrect: boolean;
  latencyMs: number;
  createdAt: string;
}

export interface ManifestV2 {
  videoId: ID;
  version: number;         // manifest version
  segments: Array<{
    segmentId: ID;
    title: string;
    tStartSec: number;
    tEndSec: number;
    questions: Array<{
      mcqId: ID;
      version: number;
      language: ISO639_1;
      stem: string;
      options: string[];   // resolved option texts in render order
      correctIndex: number;
      rationale?: string;
    }>; // 0 or 1
  }>;
}

export interface AuditLog {
  id: ID;
  actorId: ID;
  action: string;
  mcqId?: ID;
  versionFrom?: number;
  versionTo?: number;
  videoId?: ID;
  segmentId?: ID;
  message?: string;
  at: string; // ISO
}
