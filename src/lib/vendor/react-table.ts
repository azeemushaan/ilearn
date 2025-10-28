import { useMemo, useState } from 'react';

export type ColumnDef<TData, TValue = unknown> = {
  id?: string;
  accessorKey?: keyof TData & string;
  header?: string | ((ctx: HeaderContext<TData, TValue>) => React.ReactNode);
  cell?: (ctx: CellContext<TData, TValue>) => React.ReactNode;
  enableSorting?: boolean;
  meta?: Record<string, unknown>;
};

export type SortingState = { id: string; desc: boolean }[];

export type HeaderContext<TData, TValue> = {
  column: Column<TData>;
};

export type CellContext<TData, TValue> = {
  getValue: () => TValue;
  row: Row<TData>;
  column: Column<TData>;
};

export type Column<TData> = {
  id: string;
  accessorKey?: keyof TData & string;
  header?: ColumnDef<TData>['header'];
  cell?: ColumnDef<TData>['cell'];
  enableSorting?: boolean;
};

export type Row<TData> = {
  id: string;
  original: TData;
};

export type Table<TData> = {
  getHeaderGroups: () => { id: string; headers: Column<TData>[] }[];
  getRowModel: () => { rows: Row<TData>[] };
  setSorting: (updater: SortingState | ((prev: SortingState) => SortingState)) => void;
  getState: () => { sorting: SortingState };
};

export type TableOptions<TData> = {
  data: TData[];
  columns: ColumnDef<TData>[];
  state?: { sorting?: SortingState };
  onSortingChange?: (updater: SortingState) => void;
};

function sortRows<TData>(rows: Row<TData>[], columns: Column<TData>[], sorting: SortingState) {
  if (!sorting.length) return rows;
  return [...rows].sort((a, b) => {
    for (const sort of sorting) {
      const column = columns.find((c) => c.id === sort.id);
      if (!column) continue;
      const accessor = column.accessorKey;
      if (!accessor) continue;
      const aValue = (a.original as any)[accessor];
      const bValue = (b.original as any)[accessor];
      if (aValue === bValue) continue;
      if (aValue == null) return sort.desc ? 1 : -1;
      if (bValue == null) return sort.desc ? -1 : 1;
      if (aValue > bValue) return sort.desc ? -1 : 1;
      if (aValue < bValue) return sort.desc ? 1 : -1;
    }
    return 0;
  });
}

function normaliseColumns<TData>(defs: ColumnDef<TData>[]): Column<TData>[] {
  return defs.map((def, index) => ({
    id: def.id ?? def.accessorKey ?? String(index),
    accessorKey: def.accessorKey,
    header: def.header,
    cell: def.cell,
    enableSorting: def.enableSorting ?? true,
  }));
}

export function useReactTable<TData>(options: TableOptions<TData>): Table<TData> {
  const [sorting, setSortingState] = useState<SortingState>(options.state?.sorting ?? []);

  const columns = useMemo(() => normaliseColumns(options.columns), [options.columns]);
  const rows = useMemo<Row<TData>[]>(() => options.data.map((item, index) => ({ id: String(index), original: item })), [options.data]);

  const sortedRows = useMemo(() => sortRows(rows, columns, sorting), [rows, columns, sorting]);

  const setSorting = (updater: SortingState | ((prev: SortingState) => SortingState)) => {
    setSortingState((prev) => {
      const next = typeof updater === 'function' ? (updater as (prev: SortingState) => SortingState)(prev) : updater;
      options.onSortingChange?.(next);
      return next;
    });
  };

  return {
    getHeaderGroups: () => [{ id: 'header', headers: columns }],
    getRowModel: () => ({ rows: sortedRows }),
    setSorting,
    getState: () => ({ sorting }),
  };
}

export const flexRender = (renderer: ColumnDef<any>['header'] | ColumnDef<any>['cell'], ctx: any) => {
  if (typeof renderer === 'function') {
    return renderer(ctx);
  }
  return renderer ?? null;
};

export const getCoreRowModel = () => null;
export const getSortedRowModel = () => null;
