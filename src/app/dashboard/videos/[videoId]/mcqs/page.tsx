'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirebaseAuth } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Loader2, Plus, Edit, History, Play, Lock, FileText } from 'lucide-react';
import type { Segment, MCQVersioned } from '@/types/video';
import type { MCQState } from '@/types/common';
import { SegmentList } from '@/components/mcq/SegmentList';
import { MCQEditor } from '@/components/mcq/MCQEditor';
import { MCQHistory } from '@/components/mcq/MCQHistory';

interface VideoMCQ {
  mcqId: string;
  version: number;
  state: MCQState;
  segmentId: string;
  stem: string;
  options: MCQVersioned['options'];
  correctIndex: number;
  language: string;
  updatedAt: string;
}

interface MCQListItem {
  segment: Segment;
  mcq?: MCQVersioned;
  attemptsCount: number;
}

export default function VideoMCQsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const { claims } = useFirebaseAuth();

  const videoId = params.videoId as string;

  const [segments, setSegments] = useState<Segment[]>([]);
  const [mcqs, setMcqs] = useState<VideoMCQ[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [editingMcq, setEditingMcq] = useState<MCQVersioned | null>(null);
  const [showingHistory, setShowingHistory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load segments and MCQs
  useEffect(() => {
    if (!user || !videoId) return;
    loadData();
  }, [user, videoId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load segments
      const segmentsResponse = await fetch(`/api/videos/${videoId}/segments`, {
        headers: {
          'Authorization': `Bearer ${await user!.getIdToken()}`,
        },
      });
      const segmentsData = await segmentsResponse.json();
      setSegments(segmentsData.segments || []);

      // Load MCQs
      const mcqsResponse = await fetch(`/api/videos/${videoId}/mcqs`, {
        headers: {
          'Authorization': `Bearer ${await user!.getIdToken()}`,
        },
      });
      const mcqsData = await mcqsResponse.json();
      setMcqs(mcqsData.items || []);

    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load video data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDraft = async (segmentId: string) => {
    try {
      const response = await fetch(`/api/videos/${videoId}/segments/${segmentId}/mcq`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user!.getIdToken()}`,
        },
        body: JSON.stringify({
          payload: {
            language: 'en',
            stem: 'New question',
            options: [
              { id: 'opt1', text: 'Option 1' },
              { id: 'opt2', text: 'Option 2' },
              { id: 'opt3', text: 'Option 3' },
              { id: 'opt4', text: 'Option 4' },
            ],
            correctIndex: 0,
            support: [],
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setEditingMcq(data.mcq);
        setSelectedSegmentId(segmentId);
        await loadData();
      } else {
        throw new Error('Failed to create draft');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create draft',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = async (segmentId: string) => {
    try {
      const response = await fetch(`/api/videos/${videoId}/segments/${segmentId}/mcq`, {
        headers: {
          'Authorization': `Bearer ${await user!.getIdToken()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.mcq) {
          setEditingMcq(data.mcq);
          setSelectedSegmentId(segmentId);
        }
      }
    } catch (error) {
      console.error('Failed to load MCQ:', error);
    }
  };

  const handlePublish = async (mcqId: string, version: number) => {
    try {
      const response = await fetch(`/api/mcqs/${mcqId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user!.getIdToken()}`,
        },
        body: JSON.stringify({ version }),
      });

      if (response.ok) {
        toast({
          title: 'Published!',
          description: 'MCQ is now live for students',
        });
        await loadData();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to publish');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to publish MCQ',
        variant: 'destructive',
      });
    }
  };

  const handleViewHistory = (mcqId: string) => {
    setShowingHistory(mcqId);
  };

  const mcqStateBySegment = mcqs.reduce((acc, mcq) => {
    acc[mcq.segmentId] = mcq.state;
    return acc;
  }, {} as Record<string, MCQState>);

  const listItems: MCQListItem[] = segments.map(segment => {
    const mcq = mcqs.find(m => m.segmentId === segment.segmentId);
    return {
      segment,
      mcq: mcq ? {
        ...mcq,
        segmentId: mcq.segmentId,
        videoId,
        rationale: undefined,
        support: [],
        difficulty: undefined,
        createdBy: '',
        updatedBy: '',
        createdAt: mcq.updatedAt,
        updatedAt: mcq.updatedAt,
      } : undefined,
      attemptsCount: 0, // TODO: Load actual attempts count
    };
  });

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">MCQ Management</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage quiz questions for each video segment
          </p>
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list">Segment MCQs</TabsTrigger>
          <TabsTrigger value="editor" disabled={!editingMcq}>Editor</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Video Segments & MCQs
              </CardTitle>
              <CardDescription>
                Each segment can have one MCQ. Drafts are editable, Published are live for students.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SegmentList
                videoId={videoId}
                segments={segments}
                mcqStateBySegment={mcqStateBySegment}
                selectedSegmentId={selectedSegmentId || undefined}
                onSelect={setSelectedSegmentId}
                onCreateDraft={handleCreateDraft}
                onEdit={handleEdit}
              />

              {listItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No segments found. Process the video first to create segments.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="editor" className="space-y-4">
          {editingMcq && (
            <MCQEditor
              segment={segments.find(s => s.segmentId === editingMcq.segmentId)!}
              mcq={editingMcq}
              onChange={(patch) => setEditingMcq({ ...editingMcq, ...patch })}
              onValidate={async () => {
                try {
                  const response = await fetch(`/api/mcqs/${editingMcq.mcqId}/validate`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${await user!.getIdToken()}`,
                    },
                    body: JSON.stringify({ version: editingMcq.version }),
                  });
                  const data = await response.json();
                  return {
                    ok: data.ok,
                    errors: data.errors || [],
                    warnings: data.warnings || [],
                  };
                } catch (error) {
                  return {
                    ok: false,
                    errors: [{ field: 'general', message: 'Validation failed' }],
                    warnings: [],
                  };
                }
              }}
              onSaveDraft={async () => {
                if (!editingMcq) return;

                const response = await fetch(`/api/mcqs/${editingMcq.mcqId}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await user!.getIdToken()}`,
                  },
                  body: JSON.stringify({
                    version: editingMcq.version,
                    patch: {
                      stem: editingMcq.stem,
                      options: editingMcq.options,
                      correctIndex: editingMcq.correctIndex,
                      rationale: editingMcq.rationale,
                      support: editingMcq.support,
                      difficulty: editingMcq.difficulty,
                    },
                  }),
                });

                if (response.ok) {
                  toast({
                    title: 'Saved!',
                    description: 'Draft saved successfully',
                  });
                  await loadData();
                } else {
                  throw new Error('Failed to save');
                }
              }}
              onPublish={async () => {
                if (!editingMcq) return;
                await handlePublish(editingMcq.mcqId, editingMcq.version);
              }}
              onDiscard={() => {
                setEditingMcq(null);
                setSelectedSegmentId(null);
              }}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* History Modal */}
      {showingHistory && (
        <MCQHistory
          mcqId={showingHistory}
          onClose={() => setShowingHistory(null)}
        />
      )}
    </div>
  );
}
