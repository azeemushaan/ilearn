'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'ilearn_impersonation';

type ImpersonationState = {
  coachId: string | null;
};

export function useImpersonation(): [ImpersonationState, (coachId: string | null) => void] {
  const [state, setState] = useState<ImpersonationState>({ coachId: null });

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setState(parsed);
      } catch (error) {
        console.warn('Failed to parse impersonation state', error);
      }
    }
  }, []);

  const setCoachId = (coachId: string | null) => {
    const next: ImpersonationState = { coachId };
    setState(next);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return [state, setCoachId];
}
