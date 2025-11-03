'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, setDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import Logo from '@/components/logo';

export default function StudentSignupPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const [pending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    inviteCode: '',
  });

  const handleSignup = () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim() || !formData.inviteCode.trim()) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    if (formData.password.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        // 1. Verify invite code
        const invitationsRef = collection(firestore!, 'invitations');
        const inviteQuery = query(
          invitationsRef,
          where('inviteCode', '==', formData.inviteCode.toUpperCase()),
          where('status', '==', 'pending')
        );
        const inviteSnap = await getDocs(inviteQuery);

        if (inviteSnap.empty) {
          toast({ title: 'Error', description: 'Invalid or expired invite code', variant: 'destructive' });
          return;
        }

        const inviteDoc = inviteSnap.docs[0];
        const invitation = inviteDoc.data();

        // Check expiry
        const expiresAt = invitation.expiresAt?.toDate();
        if (expiresAt && expiresAt < new Date()) {
          toast({ title: 'Error', description: 'This invite code has expired', variant: 'destructive' });
          return;
        }

        // Check email matches
        if (invitation.email.toLowerCase() !== formData.email.toLowerCase()) {
          toast({ title: 'Error', description: 'Email does not match the invitation', variant: 'destructive' });
          return;
        }

        // 2. Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(
          auth!,
          formData.email,
          formData.password
        );
        const user = userCredential.user;

        // 3. Create user document
        const usersCollection = collection(firestore!, 'users');
        const userDocRef = doc(firestore!, 'users', user.uid);
        await setDoc(userDocRef, {
          coachId: invitation.coachId,
          role: 'student',
          profile: {
            name: formData.name,
            email: formData.email,
            photoUrl: null,
          },
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // 4. Update invitation status
        await updateDoc(doc(firestore!, 'invitations', inviteDoc.id), {
          status: 'accepted',
          acceptedAt: serverTimestamp(),
        });

        // 5. Set custom claims via API (student role but belongs to coach's coachId)
        await fetch('/api/auth/set-claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: user.uid,
            claims: { role: 'student', coachId: invitation.coachId },
          }),
        });

        // Force token refresh to get new claims
        await new Promise(resolve => setTimeout(resolve, 2000));
        await user.getIdToken(true);

        toast({ title: 'Success', description: 'Account created! Redirecting to dashboard...' });
        
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } catch (error: any) {
        console.error('Signup error:', error);
        toast({ title: 'Signup Failed', description: error.message, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <Logo />
          <CardTitle className="text-2xl font-bold">Student Sign Up</CardTitle>
          <CardDescription>Join your coach's class with an invite code</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-code">Invite Code</Label>
            <Input
              id="invite-code"
              placeholder="ABC123"
              value={formData.inviteCode}
              onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value.toUpperCase() })}
            />
            <p className="text-xs text-muted-foreground">
              Ask your coach for the invite code
            </p>
          </div>
          <Button onClick={handleSignup} disabled={pending} className="w-full">
            {pending ? 'Creating Account...' : 'Sign Up'}
          </Button>
          <div className="text-center text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              Log in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
