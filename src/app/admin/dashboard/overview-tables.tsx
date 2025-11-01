'use client';

import { DataTable } from '@/components/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Payment = {
  id: string;
  coachId: string;
  amount: number;
  currency: 'PKR' | 'USD';
  status: string;
  reference?: string | null;
  createdAt: Date | null;
};

type Invoice = {
  id: string;
  coachId: string;
  status: string;
  total: number;
  currency: 'PKR' | 'USD';
  createdAt: Date | null;
};

const paymentColumns: ColumnDef<Payment>[] = [
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
    cell: ({ getValue }) => (getValue() as string | null | undefined) || '-',
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => row.original.createdAt ? formatDate(row.original.createdAt) : '-',
  },
];

const invoiceColumns: ColumnDef<Invoice>[] = [
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
    cell: ({ row }) => row.original.createdAt ? formatDate(row.original.createdAt) : '-',
  },
];

export function PaymentsTable({ payments }: { payments: Payment[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent payments</CardTitle>
        <CardDescription>Latest payment attempts from coaches</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={paymentColumns} data={payments.slice(0, 20)} searchAccessor="coachId" />
      </CardContent>
    </Card>
  );
}

export function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent invoices</CardTitle>
        <CardDescription>Latest invoices issued to coaches</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={invoiceColumns} data={invoices.slice(0, 20)} searchAccessor="coachId" />
      </CardContent>
    </Card>
  );
}
