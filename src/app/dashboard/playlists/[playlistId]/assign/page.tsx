'use client';

import React from 'react';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useFirestore, useCollection, useMemoFirebase, useFirebaseAuth, useDoc } from '@/firebase';
import { collection, query, where, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';

export default function AssignPlaylistPage({ params }: { params: Promise<{ playlistId: string }> }) {
  const firestore = useFirestore();
  const router = useRouter();
  const { claims } = useFirebaseAuth();
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [daysUntilDue, setDaysUntilDue] = useState('30');

  // Unwrap the params Promise
  const unwrappedParams = React.use(params);
  const playlistId = unwrappedParams.playlistId;

  const playlistRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'playlists', playlistId);
  }, [firestore, playlistId]);

  const { data: playlist } = useDoc(playlistRef);

  const studentsRef = useMemoFirebase(() => {
    if (!firestore || !claims?.coachId) return null;
    return query(
      collection(firestore, 'users'),
      where('coachId', '==', claims.coachId),
      where('role', '==', 'student')
    );
  }, [firestore, claims]);

  const { data: students } = useCollection(studentsRef);

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleAssign = () => {
    if (!assignmentTitle.trim()) {
      toast({ title: 'Error', description: 'Please enter assignment title', variant: 'destructive' });
      return;
    }
    if (selectedStudents.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one student', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        // Set assignment to start now and end in specified days
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + parseInt(daysUntilDue)); // Days from now

        const assignmentsCollection = collection(firestore!, 'assignments');
        await addDoc(assignmentsCollection, {
          coachId: claims?.coachId,
          playlistId: playlistId,
          studentIds: selectedStudents,
          title: assignmentTitle,
          startAt: startDate,
          endAt: endDate,
          rules: {
            watchPct: 80,
            minScore: 70,
            antiSkip: true,
            attemptLimit: 3,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        toast({ title: 'Success', description: `Assignment created! Due in ${daysUntilDue} days.` });
        router.push('/dashboard/playlists');
      } catch (error) {
        toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="p-4 md:p-6 border-b">
        <h1 className="text-2xl font-headline font-bold">Assign Playlist</h1>
      </header>
      <main className="flex-1 p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{(playlist as any)?.title || 'Playlist'}</CardTitle>
            <CardDescription>Assign this playlist to students</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assignment-title">Assignment Title</Label>
              <Input
                id="assignment-title"
                placeholder="e.g., Week 1 - Introduction to Physics"
                value={assignmentTitle}
                onChange={(e) => setAssignmentTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="days-due">Days Until Due</Label>
              <Input
                id="days-due"
                type="number"
                min="1"
                max="365"
                placeholder="30"
                value={daysUntilDue}
                onChange={(e) => setDaysUntilDue(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Assignment will be due on {new Date(Date.now() + parseInt(daysUntilDue || '30') * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Select Students</Label>
              <div className="border rounded-md p-4 space-y-2 max-h-64 overflow-y-auto">
                {students?.length === 0 && (
                  <p className="text-sm text-muted-foreground">No students found. Invite students first.</p>
                )}
                {students?.map((student: any) => (
                  <div key={student.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={student.id}
                      checked={selectedStudents.includes(student.id)}
                      onCheckedChange={() => handleToggleStudent(student.id)}
                    />
                    <label htmlFor={student.id} className="text-sm cursor-pointer">
                      {student.profile?.name || student.profile?.email}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAssign} disabled={pending}>
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Assign to Students
              </Button>
              <Button variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
