'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, onIdTokenChanged, getIdTokenResult, User, Auth } from 'firebase/auth';
import { auth as clientAuth } from './client';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

type Claims = Record<string, any> | null;

type AuthCtx = {
  user: User | null;
  claims: Claims;
  initializing: boolean;     // true until we know if there is a session
  loadingClaims: boolean;    // true while we fetch claims after user is known
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

  const value = useMemo<AuthCtx>(() => ({
    user, claims, initializing, loadingClaims, refreshClaims,
  }), [user, claims, initializing, loadingClaims]);

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebaseAuth() {
  const ctx = useContext(FirebaseAuthContext);
  if (!ctx) throw new Error('useFirebaseAuth must be used within <AuthProvider>');
  return ctx;
}


// --- Legacy Provider for backwards compatibility ---

interface FirebaseProviderProps {
  children: React.ReactNode;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
}

export interface FirebaseContextState {
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  user: User | null;
  isLoading: boolean;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const { user, initializing, loadingClaims } = useFirebaseAuth();

  const contextValue = useMemo(
    (): FirebaseContextState => ({
      firebaseApp,
      firestore,
      auth,
      user,
      isLoading: initializing || loadingClaims,
    }),
    [firebaseApp, firestore, auth, user, initializing, loadingClaims]
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

export const useAuth = (): Auth | null => useFirebaseContext().auth;
export const useFirestore = (): Firestore | null => useFirebaseContext().firestore;
export const useFirebaseApp = (): FirebaseApp | null => useFirebaseContext().firebaseApp;
export const useUser = () => useFirebaseAuth();


export function useMemoFirebase<T>(factory: () => T, deps: React.DependencyList): T {
    const memoized = useMemo(factory, deps);
    if (typeof memoized === 'object' && memoized !== null) {
        (memoized as any).__memo = true;
    }
    return memoized;
}
