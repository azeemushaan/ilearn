'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase, useFirebaseAuth, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { PlusCircle, Users, Video, BarChart } from 'lucide-react';
import Link from 'next/link';
import { NotificationBell } from '@/components/ui/notification-bell';

export default function CoachDashboard() {
  const firestore = useFirestore();
  const { claims } = useFirebaseAuth();

  const subscriptionRef = useMemoFirebase(() => {
    if (!firestore || !claims?.coachId) return null;
    return query(
      collection(firestore, 'subscriptions'),
      where('coachId', '==', claims.coachId),
      where('status', 'in', ['active', 'awaiting_payment'])
    );
  }, [firestore, claims]);

  const { data: subscriptions } = useCollection(subscriptionRef);
  const activeSubscription = subscriptions?.[0];

  const planDocRef = useMemoFirebase(() => {
    if (!firestore || !activeSubscription?.planId) return null;
    return doc(firestore, 'plans', activeSubscription.planId);
  }, [firestore, activeSubscription]);

  const { data: currentPlan } = useDoc(planDocRef);

  const playlistsRef = useMemoFirebase(() => {
    if (!firestore || !claims?.coachId) return null;
    return query(
      collection(firestore, 'playlists'),
      where('coachId', '==', claims.coachId)
    );
  }, [firestore, claims]);

  const { data: playlists } = useCollection(playlistsRef);

  const studentsRef = useMemoFirebase(() => {
    if (!firestore || !claims?.coachId) return null;
    return query(
      collection(firestore, 'users'),
      where('coachId', '==', claims.coachId),
      where('role', '==', 'student')
    );
  }, [firestore, claims]);

  const { data: students } = useCollection(studentsRef);

  return (
    <div className="flex flex-1 flex-col">
      <header className="p-4 md:p-6 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-headline font-bold">Coach Dashboard</h1>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button asChild>
              <Link href="/dashboard/playlists">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Playlist
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
              <BarChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(currentPlan as any)?.title || 'Free'}</div>
              <p className="text-xs text-muted-foreground">
                {activeSubscription?.status === 'active' ? 'Active' : 'Awaiting Payment'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {students?.length || 0} / {(currentPlan as any)?.maxStudents || 0}
              </div>
              <p className="text-xs text-muted-foreground">seats used</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Playlists</CardTitle>
              <Video className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {playlists?.length || 0} / {(currentPlan as any)?.maxPlaylists || 0}
              </div>
              <p className="text-xs text-muted-foreground">playlists created</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assignments</CardTitle>
              <PlusCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">active assignments</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild className="w-full" variant="outline">
                <Link href="/dashboard/playlists">Manage Playlists</Link>
              </Button>
              <Button asChild className="w-full" variant="outline">
                <Link href="/dashboard/manage-students">Manage Students</Link>
              </Button>
              <Button asChild className="w-full" variant="outline">
                <Link href="/dashboard/coach/assignments">Manage Assignments</Link>
              </Button>
              <Button asChild className="w-full" variant="outline">
                <Link href="/dashboard/analytics">View Analytics</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
