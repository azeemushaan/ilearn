import { SubscriptionsTable } from '@/components/admin/subscriptions-table';
export const dynamic = 'force-dynamic';
import { listCoaches, listPlans, listSubscriptions } from '@/lib/firestore/admin-ops';

export default async function SubscriptionsPage() {
  const [subscriptions, coaches, plans] = await Promise.all([
    listSubscriptions(),
    listCoaches(),
    listPlans(),
  ]);

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Subscriptions</h1>
        <p className="text-muted-foreground">Monitor subscription lifecycle and manage plan changes.</p>
      </header>
      <SubscriptionsTable subscriptions={subscriptions} coaches={coaches} plans={plans} />
    </div>
  );
}
