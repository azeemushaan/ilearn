'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Edit, Play, Lock, FileText, Clock } from 'lucide-react';
import type { SegmentListProps } from '@/ui/contracts';
import type { MCQState } from '@/types/common';

const getStateBadge = (state: MCQState | "none") => {
  switch (state) {
    case "none":
      return <Badge variant="secondary">No MCQ</Badge>;
    case "draft":
      return <Badge variant="outline">Draft</Badge>;
    case "published":
      return <Badge variant="default">Published</Badge>;
    case "locked":
      return <Badge variant="destructive">Locked</Badge>;
  }
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function SegmentList({
  videoId,
  segments,
  mcqStateBySegment,
  selectedSegmentId,
  onSelect,
  onCreateDraft,
  onEdit,
}: SegmentListProps) {
  return (
    <div className="space-y-2">
      {segments.map((segment) => {
        const mcqState = mcqStateBySegment[segment.segmentId] || "none";
        const isSelected = selectedSegmentId === segment.segmentId;

        return (
          <Card
            key={segment.segmentId}
            className={`cursor-pointer transition-colors ${
              isSelected ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
            }`}
            onClick={() => onSelect(segment.segmentId)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium truncate">{segment.title}</span>
                    {getStateBadge(mcqState)}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(segment.tStartSec)} - {formatTime(segment.tEndSec)}
                    </span>
                    <span>{segment.language.toUpperCase()}</span>
                  </div>

                  {segment.text && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {segment.text}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {mcqState === "none" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateDraft(segment.segmentId);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Create MCQ
                    </Button>
                  )}

                  {mcqState === "draft" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(segment.segmentId);
                      }}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  )}

                  {mcqState === "published" && (
                    <div className="flex items-center gap-1">
                      <Play className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">Live</span>
                    </div>
                  )}

                  {mcqState === "locked" && (
                    <div className="flex items-center gap-1">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Locked</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
