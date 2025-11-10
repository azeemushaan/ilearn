'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Upload, X, AlertCircle, CheckCircle, Clock, GripVertical } from 'lucide-react';
import type { MCQEditorProps, ValidationIssue } from '@/ui/contracts';
import { SupportPicker } from './SupportPicker';
import { PublishBar } from './PublishBar';

export function MCQEditor({
  segment,
  mcq,
  onChange,
  onValidate,
  onSaveDraft,
  onPublish,
  onDiscard,
  readOnly = false,
}: MCQEditorProps) {
  const [validationState, setValidationState] = useState<{
    ok: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
  } | null>(null);

  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const result = await onValidate();
      setValidationState(result);
    } catch (error) {
      setValidationState({
        ok: false,
        errors: [{ field: 'general', message: 'Validation failed' }],
        warnings: [],
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      await onSaveDraft();
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await onPublish();
    } finally {
      setIsPublishing(false);
    }
  };

  const updateOption = (index: number, text: string) => {
    const newOptions = [...mcq.options];
    newOptions[index] = { ...newOptions[index], text };
    onChange({ options: newOptions });
  };

  const moveOption = (fromIndex: number, toIndex: number) => {
    const newOptions = [...mcq.options];
    const [moved] = newOptions.splice(fromIndex, 1);
    newOptions.splice(toIndex, 0, moved);

    // Update correctIndex if needed
    let newCorrectIndex = mcq.correctIndex;
    if (newCorrectIndex === fromIndex) {
      newCorrectIndex = toIndex;
    } else if (fromIndex < toIndex && newCorrectIndex > fromIndex && newCorrectIndex <= toIndex) {
      newCorrectIndex--;
    } else if (fromIndex > toIndex && newCorrectIndex >= toIndex && newCorrectIndex < fromIndex) {
      newCorrectIndex++;
    }

    onChange({ options: newOptions, correctIndex: newCorrectIndex });
  };

  const getFieldErrors = (field: string) =>
    validationState?.errors.filter(e => e.field === field) || [];

  const getFieldWarnings = (field: string) =>
    validationState?.warnings.filter(w => w.field === field) || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Edit MCQ - Segment {segment.title}</span>
            <div className="flex items-center gap-2">
              <Badge variant={mcq.state === 'draft' ? 'outline' : 'default'}>
                {mcq.state}
              </Badge>
              <Badge variant="secondary">v{mcq.version}</Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="question" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="question">Question</TabsTrigger>
              <TabsTrigger value="support">Support</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="question" className="space-y-4">
              {/* Question Stem */}
              <div className="space-y-2">
                <Label htmlFor="stem">Question Stem *</Label>
                <Textarea
                  id="stem"
                  value={mcq.stem}
                  onChange={(e) => onChange({ stem: e.target.value })}
                  placeholder="Enter your question..."
                  disabled={readOnly}
                  className={getFieldErrors('stem').length > 0 ? 'border-red-500' : ''}
                />
                {getFieldErrors('stem').map((error, i) => (
                  <p key={i} className="text-sm text-red-600">{error.message}</p>
                ))}
              </div>

              {/* Options */}
              <div className="space-y-3">
                <Label>Answer Options *</Label>
                {mcq.options.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    <input
                      type="radio"
                      name="correct"
                      checked={mcq.correctIndex === index}
                      onChange={() => onChange({ correctIndex: index })}
                      disabled={readOnly}
                      className="mt-0.5"
                    />
                    <Input
                      value={option.text}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      disabled={readOnly}
                      className={`flex-1 ${
                        getFieldErrors(`options.${index}.text`).length > 0 ? 'border-red-500' : ''
                      }`}
                    />
                    {mcq.correctIndex === index && (
                      <Badge variant="default">Correct</Badge>
                    )}
                  </div>
                ))}
                {getFieldErrors('options').map((error, i) => (
                  <p key={i} className="text-sm text-red-600">{error.message}</p>
                ))}
                {getFieldErrors('correctIndex').map((error, i) => (
                  <p key={i} className="text-sm text-red-600">{error.message}</p>
                ))}
              </div>

              {/* Rationale */}
              <div className="space-y-2">
                <Label htmlFor="rationale">Explanation (Optional)</Label>
                <Textarea
                  id="rationale"
                  value={mcq.rationale || ''}
                  onChange={(e) => onChange({ rationale: e.target.value })}
                  placeholder="Explain why the correct answer is right..."
                  disabled={readOnly}
                />
              </div>

              {/* Difficulty */}
              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty Level</Label>
                <Select
                  value={mcq.difficulty || ''}
                  onValueChange={(value) => onChange({ difficulty: value as any })}
                  disabled={readOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Easy">Easy</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="support" className="space-y-4">
              <SupportPicker
                segment={segment}
                value={mcq.support}
                onChange={(support) => onChange({ support })}
              />
              {getFieldErrors('support').map((error, i) => (
                <Alert key={i} variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              ))}
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium mb-4">{mcq.stem}</h3>
                  <div className="space-y-2">
                    {mcq.options.map((option, index) => (
                      <div
                        key={option.id}
                        className={`p-3 rounded border ${
                          index === mcq.correctIndex
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200'
                        }`}
                      >
                        {option.text}
                        {index === mcq.correctIndex && (
                          <Badge variant="default" className="ml-2">Correct</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                  {mcq.rationale && (
                    <div className="mt-4 p-3 bg-blue-50 rounded">
                      <p className="text-sm">{mcq.rationale}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Publish Bar */}
      <PublishBar
        state={
          isPublishing ? "publishing" :
          validationState?.ok ? "valid" :
          validationState && !validationState.ok ? "invalid" : "invalid"
        }
        errors={validationState?.errors || []}
        warnings={validationState?.warnings || []}
        attemptsExist={false} // TODO: Pass actual attempts count
        onPublish={handlePublish}
      />

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onDiscard}
          disabled={isSaving || isPublishing}
        >
          <X className="h-4 w-4 mr-2" />
          Discard Changes
        </Button>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleValidate}
            disabled={isValidating || isPublishing}
          >
            {isValidating ? (
              <Clock className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Validate
          </Button>

          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isSaving || isPublishing || readOnly}
          >
            {isSaving ? (
              <Clock className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Draft
          </Button>

          <Button
            onClick={handlePublish}
            disabled={!validationState?.ok || isPublishing || readOnly}
          >
            {isPublishing ? (
              <Clock className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Publish
          </Button>
        </div>
      </div>
    </div>
  );
}
