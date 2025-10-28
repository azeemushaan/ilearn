'use client';

import { useMemo, useState, useTransition } from 'react';
import type { Payment, Coach } from '@/lib/schemas';
import { DataTable } from '@/components/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { approvePaymentAction, rejectPaymentAction } from '@/app/admin/(dashboard)/payments/actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

export function PaymentsTable({ payments, coaches }: { payments: Payment[]; coaches: Coach[] }) {
  const [selected, setSelected] = useState<Payment | null>(null);
  const [notes, setNotes] = useState('');
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  const enhanced = useMemo(() => payments.map((payment) => ({
    ...payment,
    coachName: coaches.find((coach) => coach.id === payment.coachId)?.displayName ?? payment.coachId,
  })), [payments, coaches]);

  const filtered = enhanced.filter((payment) => {
    if (filter && !payment.coachName.toLowerCase().includes(filter.toLowerCase())) return false;
    if (status && payment.status !== status) return false;
    return true;
  });

  const columns: ColumnDef<(typeof enhanced)[number]>[] = [
    { accessorKey: 'id', header: 'Payment ID' },
    { accessorKey: 'coachName', header: 'Coach' },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => formatCurrency(row.original.amount, row.original.currency),
    },
    { accessorKey: 'method', header: 'Method' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
    },
    { accessorKey: 'reference', header: 'Reference' },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
  ];

  const handleApprove = (payment: Payment) => {
    startTransition(async () => {
      try {
        await approvePaymentAction(payment.id, notes || undefined);
        toast({ title: 'Payment approved', description: payment.reference ?? payment.id });
        setSelected(null);
        setNotes('');
      } catch (error) {
        toast({ title: 'Approval failed', description: (error as Error).message, variant: 'destructive' });
      }
    });
  };

  const handleReject = (payment: Payment) => {
    if (!notes.trim()) {
      toast({ title: 'Rejection notes required', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      try {
        await rejectPaymentAction(payment.id, notes);
        toast({ title: 'Payment rejected', description: payment.reference ?? payment.id });
        setSelected(null);
        setNotes('');
      } catch (error) {
        toast({ title: 'Rejection failed', description: (error as Error).message, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="h-9 rounded border px-2"
          placeholder="Search coach"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <select className="h-9 rounded border px-2" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <DataTable columns={columns} data={filtered} searchAccessor="coachName" onRowClick={(row) => setSelected(row as unknown as Payment)} />
      <Dialog open={!!selected} onOpenChange={(open) => {
        if (!open) setSelected(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manual payment approval</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span>Coach</span>
                  <span className="font-medium">{selected.coachId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount</span>
                  <span>{formatCurrency(selected.amount, selected.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Reference</span>
                  <span>{selected.reference ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status</span>
                  <Badge>{selected.status}</Badge>
                </div>
              </div>
              {selected.bankSlipUrl && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Bank slip</h3>
                  <div className="overflow-hidden rounded border">
                    <img src={selected.bankSlipUrl} alt="Bank slip" className="max-h-64 w-full object-contain" />
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Review notes</label>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes for the coach" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
                <Button variant="destructive" disabled={pending} onClick={() => selected && handleReject(selected)}>
                  Reject
                </Button>
                <Button disabled={pending} onClick={() => selected && handleApprove(selected)}>
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
