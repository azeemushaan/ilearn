'use client';

import { useMemo, useState, useTransition } from 'react';
import type { Payment, Coach } from '@/lib/schemas';
import { DataTable } from '@/components/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { approvePaymentAction, rejectPaymentAction } from '@/app/admin/dashboard/payments/actions';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Check, X } from 'lucide-react';

export function PaymentsTable({ payments, coaches }: { payments: Payment[]; coaches: Coach[] }) {
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
      cell: ({ row }) => {
        const status = row.original.status;
        const variant = status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary';
        return <Badge variant={variant}>{status}</Badge>;
      },
    },
    { accessorKey: 'reference', header: 'Reference' },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const payment = row.original;
        if (payment.status !== 'pending') return null;
        return (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              className="bg-green-600 hover:bg-green-700"
              disabled={pending}
              onClick={(e) => {
                e.stopPropagation();
                handleApprove(payment as unknown as Payment);
              }}
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.stopPropagation();
                handleReject(payment as unknown as Payment);
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        );
      },
    },
  ];

  const handleApprove = (payment: Payment) => {
    if (payment.status !== 'pending') return;
    startTransition(async () => {
      try {
        await approvePaymentAction(payment.id);
        toast({ title: 'Payment approved', description: `Transaction ${payment.reference} approved successfully` });
      } catch (error) {
        toast({ title: 'Approval failed', description: (error as Error).message, variant: 'destructive' });
      }
    });
  };

  const handleReject = (payment: Payment) => {
    if (payment.status !== 'pending') return;
    const reason = prompt('Enter rejection reason:');
    if (!reason?.trim()) return;
    
    startTransition(async () => {
      try {
        await rejectPaymentAction(payment.id, reason);
        toast({ title: 'Payment rejected', description: `Transaction ${payment.reference} rejected` });
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
      <DataTable columns={columns} data={filtered} searchAccessor="coachName" />
    </div>
  );
}
