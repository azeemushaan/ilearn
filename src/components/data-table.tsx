'use client';

import { useState } from 'react';
import {
  ColumnDef,
  flexRender,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type DataTableProps<TData> = {
  columns: ColumnDef<TData>[];
  data: TData[];
  searchAccessor?: keyof TData & string;
  onExportCsv?: (rows: TData[]) => void;
  onRowClick?: (row: TData) => void;
};

export function DataTable<TData>({ columns, data, searchAccessor, onExportCsv, onRowClick }: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [query, setQuery] = useState('');

  const filteredData = !query
    ? data
    : data.filter((row) => {
        if (!searchAccessor) return true;
        const value = row[searchAccessor];
        if (value == null) return false;
        return String(value).toLowerCase().includes(query.toLowerCase());
      });

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {searchAccessor && (
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search…"
            className="max-w-sm"
          />
        )}
        {onExportCsv && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExportCsv(filteredData)}
            className="ml-auto"
          >
            <FileDown className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        )}
      </div>
      <div className="rounded-md border">
        <table className="w-full caption-bottom text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortingForColumn = sorting.find((item) => item.id === header.id);
                  return (
                    <th key={header.id} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">
                      <button
                        className="flex items-center gap-1"
                        onClick={() => {
                          if (!header.enableSorting) return;
                          if (sortingForColumn) {
                            table.setSorting((prev) =>
                              prev.map((item) =>
                                item.id === header.id ? { ...item, desc: !item.desc } : item
                              )
                            );
                          } else {
                            table.setSorting((prev) => [...prev, { id: header.id, desc: false }]);
                          }
                        }}
                      >
                        {flexRender(header.header, { column: header })}
                        {sortingForColumn ? (
                          sortingForColumn.desc ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUp className="h-3 w-3" />
                          )
                        ) : (
                          header.enableSorting ? <ArrowUpDown className="h-3 w-3" /> : null
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn('border-t transition hover:bg-muted/40', onRowClick && 'cursor-pointer')}
                onClick={() => onRowClick?.(row.original)}
              >
                {columns.map((column, index) => (
                  <td key={column.id ?? column.accessorKey ?? index.toString()} className="px-3 py-2 align-middle">
                    {flexRender(column.cell ?? (() => (column.accessorKey ? (row.original as any)[column.accessorKey] : null)), {
                      getValue: () => (column.accessorKey ? (row.original as any)[column.accessorKey] : null),
                      row,
                      column: column as any,
                    })}
                  </td>
                ))}
              </tr>
            ))}
            {!table.getRowModel().rows.length && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-muted-foreground">
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
