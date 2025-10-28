'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirestore, useCollection, useMemoFirebase, useFirebaseAuth, useDoc } from "@/firebase";
import { PlusCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { collection, query, where, doc } from "firebase/firestore";

export default function DashboardPage() {
  const firestore = useFirestore();
  const { user, claims } = useFirebaseAuth();

  // Query for the user's active subscription in the /subscriptions collection
  const userSubscriptionRef = useMemoFirebase(() => {
    if (!firestore || !claims?.coachId) return null;
    return query(
      collection(firestore, "subscriptions"), 
      where("coachId", "==", claims.coachId),
      where("status", "in", ["active", "awaiting_payment"])
    );
  }, [firestore, claims]);

  const { data: subscriptions } = useCollection(userSubscriptionRef);
  const activeSubscription = subscriptions?.[0];

  // Get the details of the plan from the /subscription_plans collection
  const planDocRef = useMemoFirebase(() => {
    if(!firestore || !activeSubscription?.planId) return null;
    return doc(firestore, "subscription_plans", activeSubscription.planId);
  }, [firestore, activeSubscription]);

  const { data: currentPlanData } = useDoc(planDocRef as any);
  const currentPlan = currentPlanData as any;

  // A user can create a playlist if they have an active subscription with a seat limit > 0
  const canCreatePlaylist = activeSubscription?.status === 'active' && activeSubscription.seatLimit > 0;


  return (
    <div className="flex flex-1 flex-col">
      <header className="p-4 md:p-6 border-b">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-headline font-bold">Dashboard</h1>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" asChild disabled={!canCreatePlaylist}>
                <Link href="/dashboard/assign">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Assign New Playlist
                </Link>
            </Button>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">
        <div className="grid gap-6">
            {!activeSubscription && (
              <Card className="bg-yellow-50 border-yellow-200">
                <CardHeader className="flex flex-row items-center gap-4">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                  <div>
                  <CardTitle className="text-yellow-800">No Active Subscription</CardTitle>
                  <CardDescription className="text-yellow-700">Please choose a subscription plan to access all features.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="link" className="p-0 text-yellow-800">
                    <Link href="/dashboard/subscription">View Plans</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
             {activeSubscription && activeSubscription.status === 'awaiting_payment' && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="flex flex-row items-center gap-4">
                  <AlertCircle className="h-6 w-6 text-blue-600" />
                  <div>
                  <CardTitle className="text-blue-800">Subscription Pending</CardTitle>
                  <CardDescription className="text-blue-700">Your payment is currently being verified. This may take a few minutes.</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            )}
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Current Plan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold">{currentPlan?.name ?? 'N/A'}</p>
                        <p className="text-sm text-muted-foreground">{activeSubscription?.status ? `Status: ${activeSubscription.status}` : 'No active plan'}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Students Enrolled</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold">0 / {currentPlan?.maxStudents ?? 'N/A'}</p>
                        <p className="text-sm text-muted-foreground">seats used</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Playlists Created</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold">0 / {currentPlan?.maxPlaylists ?? 'N/A'}</p>
                        <p className="text-sm text-muted-foreground">playlists used</p>
                    </CardContent>
                </Card>
             </div>
        </div>
      </main>
    </div>
  );
}
