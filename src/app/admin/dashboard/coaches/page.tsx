import { CoachesTable } from '@/components/admin/coaches-table';
export const dynamic = 'force-dynamic';
import { listCoaches, listInvoices, listPayments, listSubscriptions } from '@/lib/firestore/admin-ops';

export default async function CoachesPage() {
  const [coaches, subscriptions, invoices, payments] = await Promise.all([
    listCoaches(),
    listSubscriptions(),
    listInvoices(),
    listPayments(),
  ]);

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Coaches</h1>
        <p className="text-muted-foreground">Manage coaches, impersonate for support, and access billing records.</p>
      </header>
      <CoachesTable coaches={coaches} subscriptions={subscriptions} invoices={invoices} payments={payments} />
    </div>
  );
}
