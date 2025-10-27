'use client';

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '@/firebase/provider'; // Adjusted import path

/**
 * Interface for the return value of the useUser hook.
 */
export interface UseUserResult {
  user: User | null;       // The authenticated user, or null.
  isLoading: boolean;      // True during initial auth check.
  error: Error | null;     // Error from auth listener, or null.
}

/**
 * React hook to get the current authenticated user from Firebase.
 * It manages loading and error states for the authentication process.
 *
 * This hook should be used within a component wrapped by `FirebaseProvider`.
 *
 * @returns {UseUserResult} An object containing the user, loading state, and error.
 */
export function useUser(): UseUserResult {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      // Optionally set an error if auth service is not available
      setError(new Error("Firebase Auth service is not available."));
      return;
    }

    // Reset state for new auth instance
    setIsLoading(true);
    setError(null);
    
    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser); // User is either authenticated or null
        setIsLoading(false);
      },
      (err) => {
        console.error("useUser - onAuthStateChanged error:", err);
        setError(err);
        setIsLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [auth]); // Re-run effect if the auth instance changes

  return { user, isLoading, error };
}
