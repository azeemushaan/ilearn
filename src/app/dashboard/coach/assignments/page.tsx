'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase, useFirebaseAuth } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Calendar, Users, Trash2, Eye } from 'lucide-react';
import Link from 'next/link';
import { deleteAssignment } from '@/app/dashboard/assignments/[assignmentId]/actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function CoachAssignmentsPage() {
  const firestore = useFirestore();
  const { claims } = useFirebaseAuth();
  const { toast } = useToast();
  const router = useRouter();

  const assignmentsRef = useMemoFirebase(() => {
    if (!firestore || !claims?.coachId) return null;
    return query(
      collection(firestore, 'assignments'),
      where('coachId', '==', claims.coachId)
    );
  }, [firestore, claims]);

  const { data: assignments } = useCollection(assignmentsRef);

  const handleDelete = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await deleteAssignment(assignmentId);
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Assignment deleted successfully',
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete assignment',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete assignment',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (assignment: any) => {
    const now = new Date();
    const startAt = assignment.startAt?.toDate ? assignment.startAt.toDate() : new Date(assignment.startAt);
    const endAt = assignment.endAt?.toDate ? assignment.endAt.toDate() : new Date(assignment.endAt);

    if (now < startAt) {
      return <Badge variant="outline">Upcoming</Badge>;
    } else if (now > endAt) {
      return <Badge variant="secondary">Completed</Badge>;
    } else {
      return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="p-4 md:p-6 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-headline font-bold">My Assignments</h1>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assignments?.map((assignment) => (
            <Card key={assignment.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{assignment.title}</CardTitle>
                  {getStatusBadge(assignment)}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Due: {new Date(assignment.endAt?.toDate ? assignment.endAt.toDate() : assignment.endAt).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {assignment.studentIds?.length || 0} students
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {assignment.description || 'No description provided'}
                </p>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link href={`/dashboard/assignments/${assignment.id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(assignment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {assignments?.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No assignments created yet.</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/playlists">Create Assignment</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
