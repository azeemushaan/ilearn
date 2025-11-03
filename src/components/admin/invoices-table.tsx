'use client';

import { useState, useTransition } from 'react';
import type { Invoice, Coach } from '@/lib/schemas';
import { DataTable } from '@/components/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { updateInvoiceStatusAction } from '@/app/admin/dashboard/invoices/actions';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

export function InvoicesTable({ invoices, coaches }: { invoices: Invoice[]; coaches: Coach[] }) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Invoice | null>(null);

  const columns: ColumnDef<Invoice>[] = [
    { accessorKey: 'id', header: 'Invoice ID' },
    { accessorKey: 'coachId', header: 'Coach' },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) => formatCurrency(row.original.total, row.original.currency),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
    },
    {
      accessorKey: 'dueAt',
      header: 'Due',
      cell: ({ row }) => formatDate(row.original.dueAt),
    },
  ];

  const handleStatusChange = (status: 'draft' | 'sent' | 'paid' | 'void') => {
    if (!selected) return;
    startTransition(async () => {
      try {
        await updateInvoiceStatusAction(selected.id, status);
        toast({ title: 'Invoice updated', description: `Status set to ${status}` });
        setSelected(null);
      } catch (error) {
        toast({ title: 'Failed to update invoice', description: (error as Error).message, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="space-y-4">
      <DataTable columns={columns} data={invoices} searchAccessor="coachId" onRowClick={setSelected} />
      {selected && (
        <div className="rounded border p-4">
          <h3 className="text-lg font-semibold">Invoice {selected.id}</h3>
          <p className="text-sm text-muted-foreground">Coach: {selected.coachId}</p>
          <p className="text-sm text-muted-foreground">Amount: {formatCurrency(selected.total, selected.currency)}</p>
          <div className="flex flex-wrap gap-2 pt-3">
            {(['draft', 'sent', 'paid', 'void'] as const).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={status === selected.status ? 'default' : 'outline'}
                disabled={pending}
                onClick={() => handleStatusChange(status)}
              >
                Mark {status}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
