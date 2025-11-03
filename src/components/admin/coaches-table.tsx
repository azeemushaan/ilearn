'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import type { Coach, Invoice, Payment, Subscription } from '@/lib/schemas';
import { DataTable } from '@/components/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { disableCoachAction, enableCoachAction, deleteCoachAction } from '@/app/admin/dashboard/coaches/actions';
import { useImpersonation } from '@/hooks/use-impersonation';
import { toast } from '@/hooks/use-toast';
import { CreateInvoiceDialog } from '@/components/admin/create-invoice-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export type CoachesTableProps = {
  coaches: Coach[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  payments: Payment[];
};

export function CoachesTable({ coaches, subscriptions, invoices, payments }: CoachesTableProps) {
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [impersonation, setImpersonation] = useImpersonation();
  const [pending, startTransition] = useTransition();

  const coachRows = useMemo(() => coaches.map((coach) => {
    const activeSubscription = subscriptions.find((subscription) => subscription.coachId === coach.id && subscription.status === 'active');
    return {
      ...coach,
      planTier: 'N/A',
      seatLimit: activeSubscription?.maxStudents ?? 0,
      status: activeSubscription?.status ?? 'inactive',
    };
  }), [coaches, subscriptions]);

  useEffect(() => {
    if (!selectedCoachId && coachRows.length) {
      setSelectedCoachId(coachRows[0].id);
    }
  }, [coachRows, selectedCoachId]);

  const columns: ColumnDef<(typeof coachRows)[number]>[] = [
    {
      accessorKey: 'id',
      header: 'Coach ID',
    },
    {
      accessorKey: 'displayName',
      header: 'Name',
    },
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'planTier',
      header: 'Current tier',
    },
    {
      accessorKey: 'seatLimit',
      header: 'Seats',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <Badge variant="outline">{String(getValue())}</Badge>,
    },
  ];

  const selectedCoach = selectedCoachId ? coaches.find((coach) => coach.id === selectedCoachId) : null;
  const coachSubscriptions = selectedCoachId ? subscriptions.filter((subscription) => subscription.coachId === selectedCoachId) : [];
  const coachInvoices = selectedCoachId ? invoices.filter((invoice) => invoice.coachId === selectedCoachId) : [];
  const coachPayments = selectedCoachId ? payments.filter((payment) => payment.coachId === selectedCoachId) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div>
        <DataTable
          columns={columns}
          data={coachRows}
          searchAccessor="displayName"
          onRowClick={(row) => setSelectedCoachId(row.id)}
        />
        <div className="mt-3 text-sm text-muted-foreground">
          Click a row to load coach details and actions.
        </div>
      </div>
      <aside className="rounded-lg border p-4 space-y-4 bg-card">
        {selectedCoach ? (
          <div className="space-y-4">
            <header className="space-y-1">
              <h2 className="text-xl font-semibold">{selectedCoach.displayName}</h2>
              <p className="text-sm text-muted-foreground">{selectedCoach.email}</p>
              <p className="text-xs text-muted-foreground">Coach ID: {selectedCoach.id}</p>
            </header>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setImpersonation(selectedCoach.id)}
                disabled={impersonation.coachId === selectedCoach.id}
              >
                Impersonate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  startTransition(async () => {
                    await disableCoachAction(selectedCoach.id);
                    toast({ description: `Coach ${selectedCoach.displayName} disabled.` });
                  });
                }}
                disabled={pending}
              >
                Disable coach
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  startTransition(async () => {
                    await enableCoachAction(selectedCoach.id);
                    toast({ description: `Coach ${selectedCoach.displayName} enabled.` });
                  });
                }}
                disabled={pending}
              >
                Enable coach
              </Button>
              <CreateInvoiceDialog coachId={selectedCoach.id} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" disabled={pending}>
                    Delete Coach
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p className="font-semibold text-destructive">
                        This action cannot be undone. This will permanently delete:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Coach account: {selectedCoach.displayName}</li>
                        <li>All associated students and their Firebase Auth accounts</li>
                        <li>All subscriptions and billing records</li>
                        <li>All playlists, videos, and assignments</li>
                        <li>All student progress and quiz attempts</li>
                        <li>All uploaded files (bank slips, etc.)</li>
                      </ul>
                      <p className="text-sm mt-2">
                        Type <span className="font-mono font-bold">DELETE</span> to confirm.
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        const input = prompt(`Type DELETE to confirm deletion of ${selectedCoach.displayName}`);
                        if (input === 'DELETE') {
                          startTransition(async () => {
                            try {
                              await deleteCoachAction(selectedCoach.id);
                              toast({ 
                                title: 'Coach Deleted',
                                description: `${selectedCoach.displayName} and all associated data have been permanently deleted.`,
                              });
                              setSelectedCoachId(null);
                            } catch (error: any) {
                              toast({ 
                                title: 'Deletion Failed',
                                description: error.message || 'Failed to delete coach. Please try again.',
                                variant: 'destructive'
                              });
                            }
                          });
                        } else {
                          toast({ 
                            title: 'Deletion Cancelled',
                            description: 'Coach was not deleted.',
                          });
                        }
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Forever
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase">Subscriptions</h3>
              <div className="space-y-1 text-sm">
                {coachSubscriptions.map((subscription) => (
                  <div key={subscription.id} className="rounded border px-3 py-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Subscription</span>
                      <span>{subscription.status}</span>
                    </div>
                    <div className="text-sm">Students: {subscription.maxStudents}</div>
                    <div className="text-xs text-muted-foreground">Renewal: {formatDate(subscription.currentPeriodEnd)}</div>
                  </div>
                ))}
                {!coachSubscriptions.length && <p className="text-xs text-muted-foreground">No subscriptions</p>}
              </div>
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase">Invoices</h3>
              <div className="space-y-1 text-sm">
                {coachInvoices.map((invoice) => (
                  <div key={invoice.id} className="rounded border px-3 py-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{invoice.status}</span>
                      <span>{formatDate(invoice.createdAt)}</span>
                    </div>
                    <div className="text-sm">{formatCurrency(invoice.total, invoice.currency)}</div>
                  </div>
                ))}
                {!coachInvoices.length && <p className="text-xs text-muted-foreground">No invoices</p>}
              </div>
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase">Payments</h3>
              <div className="space-y-1 text-sm">
                {coachPayments.map((payment) => (
                  <div key={payment.id} className="rounded border px-3 py-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{payment.status}</span>
                      <span>{formatDate(payment.createdAt)}</span>
                    </div>
                    <div className="text-sm">{formatCurrency(payment.amount, payment.currency)}</div>
                  </div>
                ))}
                {!coachPayments.length && <p className="text-xs text-muted-foreground">No payments</p>}
              </div>
            </section>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Select a coach to view details.</div>
        )}
      </aside>
    </div>
  );
}

