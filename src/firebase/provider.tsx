'use client';

import React, {
  DependencyList,
  createContext,
  useContext,
  ReactNode,
  useMemo,
  useState,
  useEffect,
  useRef,
} from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import {
  Auth,
  User,
  onAuthStateChanged,
  onIdTokenChanged,
  getIdTokenResult,
} from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { auth as clientAuth } from './client';
import { initializeFirebase } from '.';

// --- START: New Authoritative Auth Provider from Senior Dev ---

type Claims = Record<string, any> | null;

type AuthCtx = {
  user: User | null;
  claims: Claims;
  initializing: boolean; // true until we know if there is a session
  loadingClaims: boolean; // true while we fetch claims after user is known
  refreshClaims: () => Promise<void>;
};

const FirebaseAuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Claims>(null);
  const [initializing, setInitializing] = useState(true);
  const [loadingClaims, setLoadingClaims] = useState(false);

  // Keep user in sync
  useEffect(() => {
    const unsub = onAuthStateChanged(clientAuth, (u) => {
      setUser(u);
      setClaims(null);
      setLoadingClaims(!!u);
      setInitializing(false);
    });
    return () => unsub();
  }, []);

  // React to token/claims changes (this fires after custom-claims updates too)
  useEffect(() => {
    const unsub = onIdTokenChanged(clientAuth, async (u) => {
      if (!u) {
        setClaims(null);
        setLoadingClaims(false);
        return;
      }
      setLoadingClaims(true);
      try {
        const res = await getIdTokenResult(u, false); // no force by default
        setClaims(res.claims || {});
      } finally {
        setLoadingClaims(false);
      }
    });
    return () => unsub();
  }, []);

  // Manual refresher (useful right after login)
  const refreshClaims = async () => {
    if (!clientAuth.currentUser) return;
    setLoadingClaims(true);
    try {
      const res = await getIdTokenResult(clientAuth.currentUser, true); // FORCE refresh
      setClaims(res.claims || {});
    } finally {
      setLoadingClaims(false);
    }
  };

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      claims,
      initializing,
      loadingClaims,
      refreshClaims,
    }),
    [user, claims, initializing, loadingClaims]
  );

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebaseAuth() {
  const ctx = useContext(FirebaseAuthContext);
  if (!ctx)
    throw new Error('useFirebaseAuth must be used within <AuthProvider>');
  return ctx;
}

// --- END: New Authoritative Auth Provider ---


interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  user: User | null; // Kept for backward compatibility with other components
  isLoading: boolean; // Kept for backward compatibility
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(
  undefined
);

/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const { user, initializing } = useFirebaseAuth(); // Get user from new provider

  const contextValue = useMemo(
    (): FirebaseContextState => ({
      firebaseApp,
      firestore,
      auth,
      user,
      isLoading: initializing, // Map new `initializing` state to old `isLoading`
    }),
    [firebaseApp, firestore, auth, user, initializing]
  );

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};


function useFirebaseContext() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebaseContext must be used within a FirebaseProvider.');
  }
  return context;
}

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth | null => {
  return useFirebaseContext().auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore | null => {
  return useFirebaseContext().firestore;
};

/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp | null => {
  return useFirebaseContext().firebaseApp;
};

/**
 * Hook specifically for accessing the authenticated user's state.
 * This now uses the new, more reliable AuthProvider internally.
 */
export const useUser = () => {
  const { user, initializing, loadingClaims } = useFirebaseAuth();
  return { user, isLoading: initializing || loadingClaims };
};

type MemoFirebase<T> = T & { __memo?: boolean };

export function useMemoFirebase<T>(
  factory: () => T,
  deps: DependencyList
): T | MemoFirebase<T> {
  const memoized = useMemo(factory, deps);

  if (typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;

  return memoized;
}
