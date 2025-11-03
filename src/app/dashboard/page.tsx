'use client';
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirebaseAuth, useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import MyAssignmentsPage from "./my-assignments/page";
import CoachDashboard from "./coach/page";

export default function DashboardPage() {
  const { claims, loadingClaims, initializing } = useFirebaseAuth();
  const { user } = useUser();
  const router = useRouter();

  // Debug logging
  useEffect(() => {
    console.log('[Dashboard] Auth state:', { 
      hasUser: !!user, 
      initializing, 
      loadingClaims, 
      hasClaims: !!claims,
      role: claims?.role 
    });
  }, [user, initializing, loadingClaims, claims]);

  useEffect(() => {
    // If no user after 3 seconds, redirect to login
    if (!initializing && !user) {
      const timer = setTimeout(() => {
        console.log('[Dashboard] No user, redirecting to login');
        router.push('/login');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [user, router, initializing]);

  // Wait for initial auth check
  if (initializing) {
    console.log('[Dashboard] Initializing auth...');
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <p>Checking authentication...</p>
      </div>
    );
  }

  // No user authenticated
  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <p>Redirecting to login...</p>
      </div>
    );
  }

  // Wait for claims to load
  if (loadingClaims) {
    console.log('[Dashboard] Loading claims...');
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <p>Loading your profile...</p>
      </div>
    );
  }

  // Claims loaded but empty or missing role
  if (!claims || !claims.role) {
    console.log('[Dashboard] No claims or role found:', claims);
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Account Setup Required</CardTitle>
            <CardDescription>Your account needs to be configured</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your account was created but needs additional setup. Please contact support or log out and sign up again.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()} variant="outline" className="flex-1">
                Refresh
              </Button>
              <Button onClick={async () => {
                const auth = (await import('@/firebase/client')).auth;
                await auth.signOut();
                router.push('/login');
              }} className="flex-1">
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Route based on role
  if (claims.role === 'student') {
    return <MyAssignmentsPage />;
  }

  if (claims.role === 'coach') {
    return <CoachDashboard />;
  }

  // Fallback for unknown roles
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome!</CardTitle>
          <CardDescription>Your account is being set up...</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If this persists, please contact support.
          </p>
          <Button onClick={() => router.push('/login')} className="mt-4 w-full">
            Return to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
