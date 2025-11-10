// src/ui/contracts.tsx

import { MCQVersioned, Segment } from "../types/video";

export type ValidationIssue = { field: string; message: string };

export interface SegmentListProps {
  videoId: string;
  segments: Segment[];
  mcqStateBySegment: Record<string, "none"|"draft"|"published"|"locked">;
  selectedSegmentId?: string;
  onSelect: (segmentId: string) => void;
  onCreateDraft: (segmentId: string) => void;
  onEdit: (segmentId: string) => void;
}

export interface SupportPickerProps {
  segment: Segment;
  value: MCQVersioned["support"];
  onChange: (next: MCQVersioned["support"]) => void;
  // Optional: transcript data source already loaded by parent
}

export interface MCQEditorProps {
  segment: Segment;
  mcq: MCQVersioned;            // draft being edited (or v+1 fork)
  onChange: (patch: Partial<MCQVersioned>) => void;
  onValidate: () => Promise<{ ok: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[] }>;
  onSaveDraft: () => Promise<void>;
  onPublish: () => Promise<void>;  // disabled until valid
  onDiscard: () => void;           // discard draft changes
  readOnly?: boolean;              // when state=locked
}

export interface MCQListProps {
  videoId: string;
  items: Array<{ segment: Segment; mcq?: MCQVersioned; attemptsCount: number }>;
  onOpenEditor: (segmentId: string) => void;
  onPublish: (mcqId: string, version: number) => Promise<void>;
  onUnpublish: (mcqId: string, version: number) => Promise<void>;
  onViewHistory: (mcqId: string) => void;
}

export interface PublishBarProps {
  state: "invalid"|"valid"|"publishing";
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  attemptsExist: boolean;
  onPublish: () => void;
}

export interface LogsPanelProps {
  videoId: string;
  segmentId?: string;
  height?: number;
}

export interface HistoryDrawerProps {
  mcqId: string;
  versions: MCQVersioned[];
  onRestoreToDraft: (version: number) => Promise<void>; // clones content into new draft
}
