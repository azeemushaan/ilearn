// src/types/common.ts

export type ID = string;

export enum MCQState {
  Draft = "draft",
  Published = "published",
  Locked = "locked", // auto when attempts exist for this mcqId+version
}

export enum MCQEditReason {
  FixTypo = "FIX_TYPO",
  ImproveClarity = "IMPROVE_CLARITY",
  ReplaceDistractors = "REPLACE_DISTRACTORS",
  Other = "OTHER",
}

export enum SkipReason {
  Intro = "INTRO",
  Music = "MUSIC",
  OffTopic = "OFF_TOPIC",
  Short = "SHORT",
  InsufficientContext = "INSUFFICIENT_CONTEXT",
  Duplicate = "DUPLICATE",
  Ok = "OK",
}

export type ISO639_1 = string; // e.g., 'en', 'ur'

export interface TimeRange {
  tStartSec: number;
  tEndSec: number;
}

export interface SupportLine extends TimeRange {
  text: string; // verbatim caption line
}
