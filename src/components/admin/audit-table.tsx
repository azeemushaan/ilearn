'use client';

import type { AuditEvent } from '@/lib/schemas';
import { DataTable } from '@/components/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { formatDate } from '@/lib/utils';

export function AuditTable({ events }: { events: AuditEvent[] }) {
  const columns: ColumnDef<AuditEvent>[] = [
    { accessorKey: 'actorId', header: 'Actor' },
    { accessorKey: 'action', header: 'Action' },
    {
      accessorKey: 'target.id',
      header: 'Target',
      cell: ({ row }) => `${row.original.target.collection}/${row.original.target.id}`,
    },
    {
      accessorKey: 'ts',
      header: 'Timestamp',
      cell: ({ row }) => formatDate(row.original.ts),
    },
  ];

  const exportCsv = (rows: AuditEvent[]) => {
    const header = 'actorId,action,target,ts';
    const lines = rows.map((event) => {
      const target = `${event.target.collection}/${event.target.id}`;
      const ts = event.ts ? event.ts.toISOString() : '';
      return `${event.actorId},${event.action},${target},${ts}`;
    });
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'audit.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return <DataTable columns={columns} data={events} searchAccessor="actorId" onExportCsv={exportCsv} />;
}
