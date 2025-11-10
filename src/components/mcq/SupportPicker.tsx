'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Minus, Clock, AlertCircle } from 'lucide-react';
import type { SupportPickerProps } from '@/ui/contracts';

export function SupportPicker({ segment, value, onChange }: SupportPickerProps) {
  const [transcript, setTranscript] = useState<string>('');

  // Parse segment text into timestamped lines (mock implementation)
  // In real implementation, this would come from the actual transcript
  const transcriptLines = segment.text.split('.').map((sentence, index) => ({
    startTime: segment.tStartSec + (index * 2), // Mock timestamps
    endTime: segment.tStartSec + ((index + 1) * 2),
    text: sentence.trim() + '.',
  })).filter(line => line.text.length > 10);

  const addSupport = (line: { startTime: number; endTime: number; text: string }) => {
    const newSupport = [
      ...value,
      {
        tStartSec: line.startTime,
        tEndSec: line.endTime,
        text: line.text,
      },
    ];
    onChange(newSupport);
  };

  const removeSupport = (index: number) => {
    const newSupport = value.filter((_, i) => i !== index);
    onChange(newSupport);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Transcript Picker */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transcript Lines</CardTitle>
            <p className="text-sm text-muted-foreground">
              Select lines from the transcript to support your MCQ
            </p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {transcriptLines.map((line, index) => {
                  const isSelected = value.some(s =>
                    Math.abs(s.tStartSec - line.startTime) < 0.1 &&
                    s.text === line.text
                  );

                  return (
                    <div
                      key={index}
                      className={`p-3 rounded border cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => !isSelected && addSupport(line)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {formatTime(line.startTime)} - {formatTime(line.endTime)}
                            </span>
                          </div>
                          <p className="text-sm">{line.text}</p>
                        </div>
                        {!isSelected && (
                          <Button size="sm" variant="ghost" className="ml-2">
                            <Plus className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Selected Support */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Selected Support Lines</CardTitle>
            <p className="text-sm text-muted-foreground">
              These lines will be shown to students as evidence
            </p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {value.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No support lines selected</p>
                  <p className="text-xs mt-1">
                    Select lines from the transcript to provide evidence for your question
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {value.map((support, index) => (
                    <div
                      key={index}
                      className="p-3 rounded border bg-muted/20"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {formatTime(support.tStartSec)} - {formatTime(support.tEndSec)}
                            </span>
                          </div>
                          <p className="text-sm">{support.text}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeSupport(index)}
                          className="ml-2 text-destructive hover:text-destructive"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span>Total characters:</span>
                <Badge variant="secondary">
                  {value.reduce((sum, s) => sum + s.text.length, 0)}
                </Badge>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>Lines selected:</span>
                <Badge variant="secondary">{value.length}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Requirement:</strong> At least 40 characters of support text are needed for proper MCQ validation.
          Current: {value.reduce((sum, s) => sum + s.text.length, 0)} characters.
        </AlertDescription>
      </Alert>
    </div>
  );
}
