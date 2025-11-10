'use client';

import {useFormState, useFormStatus} from 'react-dom';

import {
  testAiConnectionAction,
  type TestAiConnectionState,
} from './actions';
import {Button} from '@/components/ui/button';

type AiTestConnectionFormProps = {
  disabled?: boolean;
};

function SubmitButton({disabled}: {disabled?: boolean}) {
  const {pending} = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={disabled || pending}>
      {pending ? 'Testing…' : 'Test connection'}
    </Button>
  );
}

export function AiTestConnectionForm({disabled}: AiTestConnectionFormProps) {
  const [state, formAction] = useFormState<TestAiConnectionState>(
    testAiConnectionAction,
    { status: 'idle' },
  );

  const showFeedback = !disabled && state.status !== 'idle';

  return (
    <form action={formAction} className="space-y-2">
      <SubmitButton disabled={disabled} />
      {disabled ? (
        <p className="text-xs text-muted-foreground">
          Add an API key and save to enable live connection tests.
        </p>
      ) : null}
      {showFeedback && state.status === 'success' ? (
        <p className="text-sm text-green-600 dark:text-green-400">
          {state.message ?? 'Connection succeeded.'}
        </p>
      ) : null}
      {showFeedback && state.status === 'error' ? (
        <p className="text-sm text-destructive">
          {state.message ?? 'Connection test failed. Check your configuration and try again.'}
        </p>
      ) : null}
      {showFeedback && state.status === 'success' && (state.provider || state.model) ? (
        <p className="text-xs text-muted-foreground">
          {state.provider ? `${state.provider}` : ''}
          {state.provider && state.model ? ' · ' : ''}
          {state.model ?? ''}
          {typeof state.latencyMs === 'number' ? ` · ${Math.round(state.latencyMs)}ms` : ''}
        </p>
      ) : null}
      {showFeedback && state.status === 'success' && state.reply ? (
        <p className="text-xs text-muted-foreground break-words">
          Response: {state.reply}
        </p>
      ) : null}
    </form>
  );
}
