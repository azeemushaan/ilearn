import { InvoicesTable } from '@/components/admin/invoices-table';
export const dynamic = 'force-dynamic';
import { listCoaches, listInvoices } from '@/lib/firestore/admin-ops';

export default async function InvoicesPage() {
  const [invoices, coaches] = await Promise.all([
    listInvoices(),
    listCoaches(),
  ]);

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Invoices</h1>
        <p className="text-muted-foreground">Track invoice lifecycle and mark payments.</p>
      </header>
      <InvoicesTable invoices={invoices} coaches={coaches} />
    </div>
  );
}
