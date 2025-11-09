import { PaymentsTable } from '@/components/admin/payments-table';
export const dynamic = 'force-dynamic';
import { listCoaches, listPayments } from '@/lib/firestore/admin-ops';

export default async function PaymentsPage() {
  const [payments, coaches] = await Promise.all([
    listPayments(),
    listCoaches(),
  ]);

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Payments</h1>
        <p className="text-muted-foreground">Review and approve manual bank transfers.</p>
      </header>
      <PaymentsTable payments={payments} coaches={coaches} />
    </div>
  );
}
