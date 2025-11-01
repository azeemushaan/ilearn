'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useFirestore, useCollection, useMemoFirebase, useFirebaseAuth } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { UserPlus, Mail, Trash2, CheckCircle, Clock, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function StudentsPage() {
  const firestore = useFirestore();
  const { claims } = useFirebaseAuth();
  const [pending, startTransition] = useTransition();
  const [inviteEmail, setInviteEmail] = useState('');
  const [open, setOpen] = useState(false);

  const studentsRef = useMemoFirebase(() => {
    if (!firestore || !claims?.coachId) return null;
    return query(
      collection(firestore, 'users'),
      where('coachId', '==', claims.coachId),
      where('role', '==', 'student')
    );
  }, [firestore, claims]);

  const { data: students } = useCollection(studentsRef);

  const invitationsRef = useMemoFirebase(() => {
    if (!firestore || !claims?.coachId) return null;
    return query(
      collection(firestore, 'invitations'),
      where('coachId', '==', claims.coachId)
    );
  }, [firestore, claims]);

  const { data: invitations } = useCollection(invitationsRef);

  const handleSendInvite = () => {
    if (!inviteEmail.trim()) {
      toast({ title: 'Error', description: 'Please enter an email address', variant: 'destructive' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast({ title: 'Error', description: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

        const invitationsCollection = collection(firestore!, 'invitations');
        await addDoc(invitationsCollection, {
          coachId: claims?.coachId,
          email: inviteEmail.toLowerCase(),
          status: 'pending',
          inviteCode,
          expiresAt,
          acceptedAt: null,
          createdAt: serverTimestamp(),
        });

        toast({
          title: 'Invite Sent!',
          description: (
            <div>
              <p>Invitation email sent to {inviteEmail}</p>
              <p className="font-mono font-bold mt-2">Invite Code: {inviteCode}</p>
              <p className="text-xs mt-1">Student will receive an email with signup instructions</p>
            </div>
          ),
        });
        setInviteEmail('');
        setOpen(false);
      } catch (error) {
        toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="p-4 md:p-6 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-headline font-bold">Students</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Student</DialogTitle>
                <DialogDescription>
                  Send an invitation to a student via email. They'll receive an invite code to join your class.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Student Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="student@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <Button onClick={handleSendInvite} disabled={pending} className="w-full">
                  <Mail className="mr-2 h-4 w-4" />
                  Send Invitation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 space-y-6">
        {/* Active Students */}
        <Card>
          <CardHeader>
            <CardTitle>Active Students</CardTitle>
            <CardDescription>Students who have accepted your invitation and are enrolled</CardDescription>
          </CardHeader>
          <CardContent>
            {!students || students.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students yet. Invite students to get started.</p>
            ) : (
              <div className="space-y-2">
                {students.map((student: any) => (
                  <div key={student.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{student.profile?.name || 'Student'}</p>
                      <p className="text-sm text-muted-foreground">{student.profile?.email}</p>
                    </div>
                    <Badge variant="default">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Active
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>Invitations waiting to be accepted</CardDescription>
          </CardHeader>
          <CardContent>
            {!invitations || invitations.filter((inv: any) => inv.status === 'pending').length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending invitations</p>
            ) : (
              <div className="space-y-2">
                {invitations
                  .filter((inv: any) => inv.status === 'pending')
                  .map((invitation: any) => (
                    <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{invitation.email}</p>
                        <p className="text-sm text-muted-foreground">
                          Code: <span className="font-mono font-bold">{invitation.inviteCode}</span>
                        </p>
                      </div>
                      <Badge variant="secondary">
                        <Clock className="mr-1 h-3 w-3" />
                        Pending
                      </Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
