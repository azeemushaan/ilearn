'use client';

import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/firebase/client';
import { useFirebaseAuth } from '@/firebase/provider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import Logo from '@/components/logo';

export default function AdminLogin() {
  const { refreshClaims, claims, user, initializing } = useFirebaseAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || 'ilearn@er21.org');
    const password = String(form.get('password') || '');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      await refreshClaims(); // force-claim refresh after login
      router.replace('/admin/dashboard'); // provider/layout will verify role and render
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Optional: auto-forward if already admin
  useEffect(() => {
    if (!initializing && user && claims?.role === 'admin') {
      router.replace('/admin/dashboard');
    }
  }, [claims, user, initializing, router]);

  return (
     <main className="flex min-h-screen items-center justify-center bg-secondary/30 p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Link href="/">
              <Logo />
            </Link>
          </div>
          <CardTitle className="font-headline text-2xl">Admin Login</CardTitle>
          <CardDescription>Enter your admin credentials to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 mt-4">
             {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input defaultValue="ilearn@er21.org" name="email" id="email" type="email" placeholder="admin@example.com" required disabled={submitting}/>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input name="password" id="password" type="password" required disabled={submitting}/>
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={submitting}>
              {submitting ? "Verifying..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
