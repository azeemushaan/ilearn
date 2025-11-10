'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { History, RotateCcw, Eye, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { MCQVersioned } from '@/types/video';
import type { HistoryDrawerProps } from '@/ui/contracts';

export function MCQHistory({ mcqId, versions, onRestoreToDraft, onClose }: HistoryDrawerProps) {
  const { user } = useUser();
  const [selectedVersion, setSelectedVersion] = useState<MCQVersioned | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);

  const handleRestoreToDraft = async (version: number) => {
    setIsRestoring(true);
    try {
      await onRestoreToDraft(version);
      toast({
        title: 'Restored to Draft',
        description: `Version ${version} content copied to new draft`,
      });
      onClose();
    } catch (error: any) {
      toast({
        title: 'Restore Failed',
        description: error.message || 'Failed to restore version',
        variant: 'destructive',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStateBadge = (state: string) => {
    switch (state) {
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      case 'published':
        return <Badge variant="default">Published</Badge>;
      case 'locked':
        return <Badge variant="destructive">Locked</Badge>;
      default:
        return <Badge variant="secondary">{state}</Badge>;
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            MCQ Version History
          </DialogTitle>
          <DialogDescription>
            View all versions of this MCQ. Published versions are live for students.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
          {/* Version List */}
          <div className="space-y-2">
            <h3 className="font-medium">Versions</h3>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {sortedVersions.map((version) => (
                  <Card
                    key={version.version}
                    className={`cursor-pointer transition-colors ${
                      selectedVersion?.version === version.version
                        ? 'ring-2 ring-primary'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedVersion(version)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">v{version.version}</span>
                            {getStateBadge(version.state)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(version.updatedAt)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVersion(version);
                          }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Version Details */}
          <div className="lg:col-span-2">
            {selectedVersion ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Version {selectedVersion.version} Details</h3>
                  <div className="flex items-center gap-2">
                    {getStateBadge(selectedVersion.state)}
                    {selectedVersion.difficulty && (
                      <Badge variant="secondary">{selectedVersion.difficulty}</Badge>
                    )}
                  </div>
                </div>

                <ScrollArea className="h-[350px]">
                  <div className="space-y-4">
                    {/* Question */}
                    <div>
                      <label className="text-sm font-medium">Question</label>
                      <p className="mt-1 p-3 bg-muted rounded">{selectedVersion.stem}</p>
                    </div>

                    {/* Options */}
                    <div>
                      <label className="text-sm font-medium">Options</label>
                      <div className="mt-1 space-y-1">
                        {selectedVersion.options.map((option, index) => (
                          <div
                            key={option.id}
                            className={`p-2 rounded border ${
                              index === selectedVersion.correctIndex
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-200'
                            }`}
                          >
                            {option.text}
                            {index === selectedVersion.correctIndex && (
                              <Badge variant="default" className="ml-2 text-xs">Correct</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rationale */}
                    {selectedVersion.rationale && (
                      <div>
                        <label className="text-sm font-medium">Explanation</label>
                        <p className="mt-1 p-3 bg-blue-50 rounded text-sm">
                          {selectedVersion.rationale}
                        </p>
                      </div>
                    )}

                    {/* Support Lines */}
                    {selectedVersion.support.length > 0 && (
                      <div>
                        <label className="text-sm font-medium">Support Lines ({selectedVersion.support.length})</label>
                        <div className="mt-1 space-y-1">
                          {selectedVersion.support.map((support, index) => (
                            <div key={index} className="p-2 bg-gray-50 rounded text-xs">
                              <div className="flex items-center gap-2 mb-1">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {Math.floor(support.tStartSec / 60)}:
                                  {(support.tStartSec % 60).toFixed(0).padStart(2, '0')} -
                                  {Math.floor(support.tEndSec / 60)}:
                                  {(support.tEndSec % 60).toFixed(0).padStart(2, '0')}
                                </span>
                              </div>
                              <p>{support.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <label className="font-medium">Created By</label>
                        <p className="text-muted-foreground">{selectedVersion.createdBy}</p>
                      </div>
                      <div>
                        <label className="font-medium">Updated By</label>
                        <p className="text-muted-foreground">{selectedVersion.updatedBy}</p>
                      </div>
                      <div>
                        <label className="font-medium">Created</label>
                        <p className="text-muted-foreground">{formatDate(selectedVersion.createdAt)}</p>
                      </div>
                      <div>
                        <label className="font-medium">Updated</label>
                        <p className="text-muted-foreground">{formatDate(selectedVersion.updatedAt)}</p>
                      </div>
                      {selectedVersion.publishedAt && (
                        <div className="col-span-2">
                          <label className="font-medium">Published</label>
                          <p className="text-muted-foreground">{formatDate(selectedVersion.publishedAt)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRestoreToDraft(selectedVersion.version)}
                    disabled={isRestoring}
                  >
                    {isRestoring ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Restoring...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restore to Draft
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a version to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
