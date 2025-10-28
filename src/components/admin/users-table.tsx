'use client';

import { useMemo, useState, useTransition } from 'react';
import type { CoachUser, Coach } from '@/lib/schemas';
import { DataTable } from '@/components/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { setClaimsAction, disableUserAction, enableUserAction } from '@/app/admin/(dashboard)/users/actions';
import { toast } from '@/hooks/use-toast';

export function UsersTable({ users, coaches }: { users: CoachUser[]; coaches: Coach[] }) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<CoachUser | null>(null);

  const enhanced = useMemo(
    () =>
      users.map((user) => ({
        ...user,
        coachName: coaches.find((coach) => coach.id === user.coachId)?.displayName ?? user.coachId,
      })),
    [users, coaches]
  );

  const columns: ColumnDef<(typeof enhanced)[number]>[] = [
    { accessorKey: 'profile.email', header: 'Email', cell: ({ row }) => row.original.profile.email },
    { accessorKey: 'profile.name', header: 'Name', cell: ({ row }) => row.original.profile.name },
    { accessorKey: 'coachName', header: 'Coach' },
    { accessorKey: 'role', header: 'Role' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
    },
  ];

  const handleClaims = (role: 'admin' | 'teacher' | 'student', coachId?: string | null) => {
    if (!selected) return;
    startTransition(async () => {
      try {
        await setClaimsAction(selected.id, role, coachId);
        toast({ title: 'Custom claims updated' });
      } catch (error) {
        toast({ title: 'Failed to update claims', description: (error as Error).message, variant: 'destructive' });
      }
    });
  };

  const handleDisable = () => {
    if (!selected) return;
    startTransition(async () => {
      try {
        await disableUserAction(selected.id);
        toast({ title: 'User disabled' });
      } catch (error) {
        toast({ title: 'Failed to disable user', description: (error as Error).message, variant: 'destructive' });
      }
    });
  };

  const handleEnable = () => {
    if (!selected) return;
    startTransition(async () => {
      try {
        await enableUserAction(selected.id);
        toast({ title: 'User enabled' });
      } catch (error) {
        toast({ title: 'Failed to enable user', description: (error as Error).message, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="space-y-4">
      <DataTable columns={columns} data={enhanced} searchAccessor="profile.email" onRowClick={(row) => setSelected(row as any)} />
      {selected && (
        <div className="rounded border p-4 space-y-3">
          <h3 className="text-lg font-semibold">{selected.profile.name}</h3>
          <p className="text-sm text-muted-foreground">{selected.profile.email}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => handleClaims('admin')}>
              Set admin
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => handleClaims('teacher', selected.coachId)}>
              Set teacher
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => handleClaims('student', selected.coachId)}>
              Set student
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={handleDisable}>
              Disable
            </Button>
            <Button size="sm" disabled={pending} onClick={handleEnable}>
              Enable
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
