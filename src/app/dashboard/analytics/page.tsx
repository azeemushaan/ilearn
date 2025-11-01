'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection, useMemoFirebase, useFirebaseAuth } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Users, Video, Target, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function AnalyticsPage() {
  const firestore = useFirestore();
  const { claims } = useFirebaseAuth();

  const studentsRef = useMemoFirebase(() => {
    if (!firestore || !claims?.coachId) return null;
    return query(
      collection(firestore, 'users'),
      where('coachId', '==', claims.coachId),
      where('role', '==', 'student')
    );
  }, [firestore, claims]);

  const { data: students } = useCollection(studentsRef);

  const assignmentsRef = useMemoFirebase(() => {
    if (!firestore || !claims?.coachId) return null;
    return query(
      collection(firestore, 'assignments'),
      where('coachId', '==', claims.coachId)
    );
  }, [firestore, claims]);

  const { data: assignments } = useCollection(assignmentsRef);

  const progressRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'progress');
  }, [firestore]);

  const { data: allProgress } = useCollection(progressRef);

  // Calculate stats
  const activeStudents = students?.filter((s: any) => s.status === 'active').length || 0;
  const activeAssignments = assignments?.filter((a: any) => {
    const now = new Date();
    const startAt = a.startAt?.toDate ? a.startAt.toDate() : new Date(a.startAt);
    const endAt = a.endAt?.toDate ? a.endAt.toDate() : new Date(a.endAt);
    return startAt <= now && now <= endAt;
  }).length || 0;

  const avgCompletion = (allProgress?.length ?? 0) > 0
    ? Math.round(allProgress!.reduce((sum: number, p: any) => sum + (p.watchPct || 0), 0) / allProgress!.length)
    : 0;

  const avgScore = (allProgress?.length ?? 0) > 0
    ? Math.round(allProgress!.reduce((sum: number, p: any) => sum + (p.score || 0), 0) / allProgress!.length)
    : 0;

  return (
    <div className="flex flex-1 flex-col">
      <header className="p-4 md:p-6 border-b">
        <h1 className="text-2xl font-headline font-bold">Analytics</h1>
        <p className="text-muted-foreground">Track student progress and performance</p>
      </header>
      <main className="flex-1 p-4 md:p-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeStudents}</div>
              <p className="text-xs text-muted-foreground">enrolled students</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Assignments</CardTitle>
              <Video className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeAssignments}</div>
              <p className="text-xs text-muted-foreground">in progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgCompletion}%</div>
              <p className="text-xs text-muted-foreground">watch percentage</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Quiz Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgScore}%</div>
              <p className="text-xs text-muted-foreground">overall performance</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Student Progress Overview</CardTitle>
            <CardDescription>Individual student performance across all assignments</CardDescription>
          </CardHeader>
          <CardContent>
            {!students || students.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students enrolled yet</p>
            ) : (
              <div className="space-y-4">
                {students.map((student: any) => {
                  const studentProgress = allProgress?.filter((p: any) => p.studentId === student.id) || [];
                  const avgWatch = studentProgress.length > 0
                    ? Math.round(studentProgress.reduce((sum: number, p: any) => sum + (p.watchPct || 0), 0) / studentProgress.length)
                    : 0;
                  const avgStudentScore = studentProgress.length > 0
                    ? Math.round(studentProgress.reduce((sum: number, p: any) => sum + (p.score || 0), 0) / studentProgress.length)
                    : 0;

                  return (
                    <div key={student.id} className="space-y-2 border-b pb-4 last:border-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{student.profile?.name}</p>
                          <p className="text-sm text-muted-foreground">{student.profile?.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{studentProgress.length} assignment{studentProgress.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Watch Progress</span>
                            <span className="font-medium">{avgWatch}%</span>
                          </div>
                          <Progress value={avgWatch} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Quiz Score</span>
                            <span className="font-medium">{avgStudentScore}%</span>
                          </div>
                          <Progress value={avgStudentScore} className="h-2" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignment Performance</CardTitle>
            <CardDescription>Progress across all active assignments</CardDescription>
          </CardHeader>
          <CardContent>
            {!assignments || assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assignments created yet</p>
            ) : (
              <div className="space-y-4">
                {assignments.map((assignment: any) => {
                  const assignmentProgress = allProgress?.filter((p: any) => p.assignmentId === assignment.id) || [];
                  const completionRate = assignment.studentIds.length > 0
                    ? Math.round((assignmentProgress.filter((p: any) => p.completedAt).length / assignment.studentIds.length) * 100)
                    : 0;

                  return (
                    <div key={assignment.id} className="space-y-2 border-b pb-4 last:border-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{assignment.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {assignmentProgress.filter((p: any) => p.completedAt).length} / {assignment.studentIds.length} completed
                        </p>
                      </div>
                      <Progress value={completionRate} className="h-2" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
