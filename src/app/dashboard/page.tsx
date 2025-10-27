'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { PlusCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { collection, query, where } from "firebase/firestore";

export default function DashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const userSubscriptionRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, "teacher_subscriptions"), where("userId", "==", user.uid), where("paymentStatus", "==", "approved"));
  }, [firestore, user]);

  const { data: subscriptions } = useCollection(userSubscriptionRef);

  const planId = subscriptions?.[0]?.subscriptionPlanId;

  const planRef = useMemoFirebase(() => {
    if(!firestore || !planId) return null;
    return query(collection(firestore, "subscription_plans"), where("id", "==", planId));
  }, [firestore, planId]);

  const { data: plans } = useCollection(planRef);
  const currentPlan = plans?.[0];

  const canCreatePlaylist = currentPlan ? (currentPlan.maxPlaylists > 0) : false; // Example logic


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
            {!currentPlan && subscriptions?.length === 0 && (
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
                    <Link href="/#pricing">View Plans</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Active Assignments</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold">0</p>
                        <p className="text-sm text-muted-foreground">playlists currently assigned</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Students Enrolled</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold">0</p>
                        <p className="text-sm text-muted-foreground">across 0 classes</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Overall Completion</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold">0%</p>
                        <p className="text-sm text-muted-foreground">average across all assignments</p>
                    </CardContent>
                </Card>
             </div>
        </div>
      </main>
    </div>
  );
}
