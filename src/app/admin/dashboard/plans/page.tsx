import { PlansManager } from '@/components/admin/plans-manager';
export const dynamic = 'force-dynamic';
import { listPlans } from '@/lib/firestore/admin-ops';

export default async function PlansPage() {
  const plans = await listPlans();
  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Plans</h1>
        <p className="text-muted-foreground">Create, edit, and archive pricing plans for coaches.</p>
      </header>
      <PlansManager plans={plans} />
    </div>
  );
}
