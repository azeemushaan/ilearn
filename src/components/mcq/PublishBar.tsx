'use client';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, XCircle, Clock, Users } from 'lucide-react';
import type { PublishBarProps } from '@/ui/contracts';

export function PublishBar({
  state,
  errors,
  warnings,
  attemptsExist,
  onPublish
}: PublishBarProps) {
  const getStateIcon = () => {
    switch (state) {
      case 'invalid':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'publishing':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStateText = () => {
    switch (state) {
      case 'invalid':
        return 'Validation Failed';
      case 'valid':
        return 'Ready to Publish';
      case 'publishing':
        return 'Publishing...';
      default:
        return 'Needs Validation';
    }
  };

  const getStateDescription = () => {
    if (state === 'publishing') {
      return attemptsExist
        ? 'Creating new version for existing attempts...'
        : 'Publishing MCQ for the first time...';
    }

    if (state === 'valid') {
      return attemptsExist
        ? 'Will create v+1 (existing attempts remain valid)'
        : 'Will publish as the first version';
    }

    return 'Fix validation errors to publish';
  };

  return (
    <div className="space-y-3">
      {/* Status Bar */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          {getStateIcon()}
          <div>
            <h3 className="font-medium">{getStateText()}</h3>
            <p className="text-sm text-muted-foreground">{getStateDescription()}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {attemptsExist && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              Has Attempts
            </Badge>
          )}

          <Button
            onClick={onPublish}
            disabled={state !== 'valid'}
            size="sm"
          >
            {state === 'publishing' ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Publishing...
              </>
            ) : (
              'Publish MCQ'
            )}
          </Button>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">Cannot publish due to errors:</p>
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="text-sm">
                    <strong>{error.field}:</strong> {error.message}
                  </li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">Warnings (can still publish):</p>
              <ul className="list-disc list-inside space-y-1">
                {warnings.map((warning, index) => (
                  <li key={index} className="text-sm">
                    <strong>{warning.field}:</strong> {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Version Info */}
      {attemptsExist && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Versioning:</strong> Since students have already attempted this MCQ,
            publishing will create a new version (v+1). Existing attempts remain valid and
            new attempts will use the updated version.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
