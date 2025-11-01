'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useFirestore, useCollection, useMemoFirebase, useFirebaseAuth, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { PlayCircle, Clock, CheckCircle2, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function MyAssignmentsPage() {
  const firestore = useFirestore();
  const { user } = useFirebaseAuth();

  // Fetch assignments where student is included
  const assignmentsRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'assignments'),
      where('studentIds', 'array-contains', user.uid)
    );
  }, [firestore, user]);

  const { data: assignments, isLoading: loadingAssignments } = useCollection(assignmentsRef);

  // Fetch playlists for assignments
  const playlistsRef = useMemoFirebase(() => {
    if (!firestore || !assignments || assignments.length === 0) return null;
    return collection(firestore, 'playlists');
  }, [firestore, assignments]);

  const { data: allPlaylists } = useCollection(playlistsRef);

  // Fetch progress for this student
  const progressRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'progress'),
      where('studentId', '==', user.uid)
    );
  }, [firestore, user]);

  const { data: progressData } = useCollection(progressRef);

  // Calculate stats
  const getAssignmentProgress = (assignmentId: string) => {
    if (!progressData) return { watchPct: 0, score: 0, completedVideos: 0, totalVideos: 0 };
    
    const assignmentProgress = progressData.filter((p: any) => p.assignmentId === assignmentId);
    if (assignmentProgress.length === 0) return { watchPct: 0, score: 0, completedVideos: 0, totalVideos: 0 };
    
    const totalWatch = assignmentProgress.reduce((sum: number, p: any) => sum + (p.watchPct || 0), 0);
    const totalScore = assignmentProgress.reduce((sum: number, p: any) => sum + (p.score || 0), 0);
    const completedVideos = assignmentProgress.filter((p: any) => p.watchPct >= 80).length;
    
    return {
      watchPct: Math.round(totalWatch / assignmentProgress.length),
      score: Math.round(totalScore / assignmentProgress.length),
      completedVideos,
      totalVideos: assignmentProgress.length,
    };
  };

  const getPlaylistForAssignment = (playlistId: string) => {
    return allPlaylists?.find((p: any) => p.id === playlistId);
  };

  const isAssignmentActive = (assignment: any) => {
    const now = new Date();
    const startAt = assignment.startAt?.toDate ? assignment.startAt.toDate() : new Date(assignment.startAt);
    const endAt = assignment.endAt?.toDate ? assignment.endAt.toDate() : new Date(assignment.endAt);
    return startAt <= now && now <= endAt;
  };

  const activeAssignments = assignments?.filter(isAssignmentActive) || [];
  const pastAssignments = assignments?.filter((a: any) => !isAssignmentActive(a)) || [];

  return (
    <div className="flex flex-1 flex-col">
      <header className="p-4 md:p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="space-y-2">
          <h1 className="text-3xl font-headline font-bold">My Assignments</h1>
          <p className="text-muted-foreground">Complete your assigned playlists and track your progress</p>
        </div>
      </header>
      
      <main className="flex-1 p-4 md:p-6 space-y-8">
        {loadingAssignments && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-muted-foreground">Loading your assignments...</p>
            </div>
          </div>
        )}
        
        {!loadingAssignments && (!assignments || assignments.length === 0) && (
          <Card className="border-2 border-dashed">
            <CardHeader className="text-center py-12">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <PlayCircle className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle>No Assignments Yet</CardTitle>
              <CardDescription className="max-w-md mx-auto">
                Your coach hasn't assigned any playlists yet. Once they do, you'll see them here and can start learning!
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Active Assignments */}
        {activeAssignments.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold">Active Assignments</h2>
              <Badge variant="default" className="bg-green-500">{activeAssignments.length}</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeAssignments.map((assignment: any) => {
                const playlist = getPlaylistForAssignment(assignment.playlistId);
                const progress = getAssignmentProgress(assignment.id);
                const daysLeft = Math.ceil(
                  ((assignment.endAt?.toDate ? assignment.endAt.toDate() : new Date(assignment.endAt)).getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24)
                );

                return (
                  <Card key={assignment.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant={daysLeft <= 3 ? "destructive" : "secondary"}>
                          <Clock className="h-3 w-3 mr-1" />
                          {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                        </Badge>
                        {progress.watchPct >= 80 && (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Complete
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <PlayCircle className="h-5 w-5 text-blue-600" />
                        {assignment.title}
                      </CardTitle>
                      <CardDescription>
                        {playlist?.title || 'Loading playlist...'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Watch Progress</span>
                          <span className="font-medium">{progress.watchPct}%</span>
                        </div>
                        <Progress value={progress.watchPct} className="h-2" />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Quiz Score</span>
                          <span className="font-medium">{progress.score}%</span>
                        </div>
                        <Progress value={progress.score} className="h-2" />
                      </div>

                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{progress.completedVideos} / {progress.totalVideos || playlist?.videoCount || 0} videos</span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" />
                          {assignment.rules?.minScore || 70}% required
                        </span>
                      </div>

                      <Button asChild className="w-full mt-4">
                        <Link href={`/dashboard/assignments/${assignment.id}`}>
                          {progress.watchPct > 0 ? 'Continue Learning' : 'Start Assignment'}
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Past Assignments */}
        {pastAssignments.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold">Past Assignments</h2>
              <Badge variant="secondary">{pastAssignments.length}</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pastAssignments.map((assignment: any) => {
                const playlist = getPlaylistForAssignment(assignment.playlistId);
                const progress = getAssignmentProgress(assignment.id);

                return (
                  <Card key={assignment.id} className="opacity-75 hover:opacity-100 transition-opacity">
                    <CardHeader>
                      <Badge variant="outline" className="w-fit mb-2">Ended</Badge>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <PlayCircle className="h-5 w-5" />
                        {assignment.title}
                      </CardTitle>
                      <CardDescription>
                        {playlist?.title || 'Loading playlist...'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Final Score</span>
                        <span className="font-medium">{progress.score}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Completion</span>
                        <span className="font-medium">{progress.watchPct}%</span>
                      </div>
                      <Button asChild variant="outline" className="w-full mt-2">
                        <Link href={`/dashboard/assignments/${assignment.id}`}>
                          View Results
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
