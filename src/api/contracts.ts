// src/api/contracts.ts

import { ID } from "../types/common";
import { MCQVersioned, Segment } from "../types/video";

/** LIST latest MCQs for a video (one per segment max) */
export namespace API_ListVideoMCQs {
  export type Path = `/api/videos/${string}/mcqs`;
  export interface Res {
    videoId: ID;
    items: Array<Pick<MCQVersioned, "mcqId"|"version"|"state"|"segmentId"|"stem"|"options"|"correctIndex"|"language"|"updatedAt">>;
  }
}

/** GET a specific segment's latest or specific version */
export namespace API_GetSegmentMCQ {
  export type Path = `/api/videos/${string}/segments/${string}/mcq`;
  export interface Query { version?: number; }
  export interface Res { mcq?: MCQVersioned; segment: Segment; attemptsCount: number; }
}

/** CREATE new draft (or fork v+1 if published/locked) */
export namespace API_CreateOrForkMCQ {
  export type Path = `/api/videos/${string}/segments/${string}/mcq`;
  export interface Body {
    baseMcqId?: ID;         // optional: fork from existing
    fromVersion?: number;   // if forking
    payload: Pick<MCQVersioned, "language"|"stem"|"options"|"correctIndex"|"rationale"|"support"|"difficulty">;
  }
  export interface Res { mcq: MCQVersioned; }
}

/** UPDATE draft only */
export namespace API_UpdateMCQ {
  export type Path = `/api/mcqs/${string}`;
  export interface Body {
    version: number; // must be current draft version
    patch: Partial<Pick<MCQVersioned, "stem"|"options"|"correctIndex"|"rationale"|"support"|"difficulty">>;
  }
  export interface Res { mcq: MCQVersioned; }
}

/** VALIDATE server-side (grounding, bounds, dedup) */
export namespace API_ValidateMCQ {
  export type Path = `/api/mcqs/${string}/validate`;
  export interface Body { version: number; }
  export interface Res {
    ok: boolean;
    errors: Array<{ field: string; message: string }>;
    warnings: Array<{ field: string; message: string }>;
  }
}

/** PUBLISH (in-place if no attempts; else fork new version) */
export namespace API_PublishMCQ {
  export type Path = `/api/mcqs/${string}/publish`;
  export interface Body { version: number; reason?: string; }
  export interface Res { mcq: MCQVersioned; publishedVersion: number; }
}

/** UNPUBLISH (only if no attempts) */
export namespace API_UnpublishMCQ {
  export type Path = `/api/mcqs/${string}/unpublish`;
  export interface Body { version: number; }
  export interface Res { state: "draft"; }
}

/** HISTORY */
export namespace API_HistoryMCQ {
  export type Path = `/api/mcqs/${string}/history`;
  export interface Res { items: MCQVersioned[]; }
}
