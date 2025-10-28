
'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'

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
  user: User | null;
  isLoading: boolean;
  error: Error | null;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Effect to subscribe to Firebase auth state changes
  useEffect(() => {
    if (!auth) { 
      setIsLoading(false);
      setError(new Error("Auth service not provided."));
      return;
    }

    // Set loading to true on mount and when auth object changes.
    setIsLoading(true);

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        // This is the key change: only set loading to false AFTER the first
        // onAuthStateChanged callback has fired.
        setIsLoading(false);
        setError(null);
      },
      (error) => {
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setError(error);
        setIsLoading(false);
      }
    );
    return () => unsubscribe(); // Cleanup
  }, [auth]); // Depends on the auth instance

  // Memoize the context value
  const contextValue = useMemo((): FirebaseContextState => ({
    firebaseApp,
    firestore,
    auth,
    user,
    isLoading,
    error,
  }), [firebaseApp, firestore, auth, user, isLoading, error]);

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
 */
export const useUser = () => {
  const { user, isLoading, error } = useFirebaseContext();
  return { user, isLoading, error };
};


type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}
