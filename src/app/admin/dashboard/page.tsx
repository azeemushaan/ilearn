'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";

export default function AdminDashboardPage() {
    const firestore = useFirestore();
    
    const teachersCollectionRef = useMemoFirebase(() => {
        if(!firestore) return null;
        return collection(firestore, 'users');
    }, [firestore]);
    const { data: teachers } = useCollection(teachersCollectionRef);

    const subscriptionsCollectionRef = useMemoFirebase(() => {
        if(!firestore) return null;
        return collection(firestore, 'subscriptions');
    }, [firestore]);
    const { data: subscriptions } = useCollection(subscriptionsCollectionRef);

    const activeSubscriptions = subscriptions?.filter((s: any) => s.status === 'active') ?? [];
    const pendingSubscriptions = subscriptions?.filter((s: any) => s.status === 'awaiting_payment') ?? [];

  return (
    <div className="flex flex-1 flex-col">
      <header className="p-4 md:p-6 border-b">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-headline font-bold">Admin Dashboard</h1>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">
        <div className="grid gap-6">
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Total Teachers</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold">{teachers?.length ?? 0}</p>
                        <p className="text-sm text-muted-foreground">teachers signed up</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Active Subscriptions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold">{activeSubscriptions.length}</p>
                        <p className="text-sm text-muted-foreground">across all plans</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Pending Payments</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold">{pendingSubscriptions.length}</p>
                        <p className="text-sm text-muted-foreground">awaiting approval</p>
                    </CardContent>
                </Card>
             </div>
        </div>
      </main>
    </div>
  );
}
