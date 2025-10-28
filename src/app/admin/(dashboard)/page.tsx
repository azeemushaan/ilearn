import { listCoaches, listInvoices, listPayments, listSubscriptions } from '@/lib/firestore/admin-ops';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DataTable } from '@/components/data-table';
import type { ColumnDef } from '@tanstack/react-table';

export default async function AdminOverviewPage() {
  const [coaches, subscriptions, payments] = await Promise.all([
    listCoaches(),
    listSubscriptions(),
    listPayments(),
  ]);

  const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === 'active');
  const pendingPayments = payments.filter((payment) => payment.status === 'pending');
  const failedPayments = payments.filter((payment) => payment.status === 'rejected');
  const newCoachesThisWeek = coaches.filter((coach) => {
    if (!coach.createdAt) return false;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return coach.createdAt >= sevenDaysAgo;
  }).length;
  const mrr = activeSubscriptions.reduce((total, subscription) => {
    const plan = subscription.tier;
    if (plan === 'free') return total;
    const relatedPayment = payments.find((payment) => payment.coachId === subscription.coachId && payment.status === 'approved');
    if (!relatedPayment) return total;
    return total + relatedPayment.amount;
  }, 0);

  const paymentColumns: ColumnDef<(typeof payments)[number]>[] = [
    {
      accessorKey: 'coachId',
      header: 'Coach',
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => formatCurrency(row.original.amount, row.original.currency),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const value = getValue() as string;
        return value.replace('_', ' ');
      },
    },
    {
      accessorKey: 'reference',
      header: 'Reference',
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
  ];

  const auditColumns: ColumnDef<(Awaited<ReturnType<typeof listInvoices>>)[number]>[] = [
    {
      accessorKey: 'id',
      header: 'Invoice',
    },
    {
      accessorKey: 'coachId',
      header: 'Coach',
    },
    {
      accessorKey: 'status',
      header: 'Status',
    },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) => formatCurrency(row.original.total, row.original.currency),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
  ];

  const invoices = await listInvoices();

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-semibold">Overview</h1>
        <p className="text-muted-foreground">High-level metrics for iLearn ER21.</p>
      </header>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>New coaches</CardTitle>
            <CardDescription>Joined in the last 7 days</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{newCoachesThisWeek}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active subscriptions</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{activeSubscriptions.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending payments</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{pendingPayments.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>MRR (approx)</CardTitle>
            <CardDescription>Based on last approved payment</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{formatCurrency(mrr, 'PKR')}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Failed payments</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{failedPayments.length}</CardContent>
        </Card>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent payments</CardTitle>
            <CardDescription>Latest payment attempts from coaches</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={paymentColumns} data={payments.slice(0, 20)} searchAccessor="coachId" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent invoices</CardTitle>
            <CardDescription>Latest invoices issued to coaches</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={auditColumns} data={invoices.slice(0, 20)} searchAccessor="coachId" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
