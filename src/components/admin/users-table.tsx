'use client';

import { useMemo, useState, useTransition } from 'react';
import type { CoachUser, Coach } from '@/lib/schemas';
import { DataTable } from '@/components/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { setClaimsAction, disableUserAction, enableUserAction, deleteUserAction } from '@/app/admin/dashboard/users/actions';
import { toast } from '@/hooks/use-toast';
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

export function UsersTable({ users, coaches }: { users: CoachUser[]; coaches: Coach[] }) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<CoachUser | null>(null);

  const enhanced = useMemo(
    () =>
      users.map((user) => ({
        ...user,
        coachName: coaches.find((coach) => coach.id === user.coachId)?.displayName ?? user.coachId,
        email: user.profile.email,
        name: user.profile.name,
      })),
    [users, coaches]
  );

  const columns: ColumnDef<(typeof enhanced)[number]>[] = [
    { accessorKey: 'name', header: 'Student Name' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'coachName', header: 'Coach' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        const variant = status === 'active' ? 'default' : status === 'disabled' ? 'destructive' : 'secondary';
        return <Badge variant={variant}>{status}</Badge>;
      },
    },
  ];

  const handleClaims = (role: 'admin' | 'coach' | 'student', coachId?: string | null) => {
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

  const handleDelete = () => {
    if (!selected) return;
    const input = prompt(`Type DELETE to confirm deletion of ${selected.profile.name}`);
    if (input === 'DELETE') {
      startTransition(async () => {
        try {
          await deleteUserAction(selected.id);
          toast({ 
            title: 'User Deleted',
            description: `${selected.profile.name} has been permanently deleted.`,
          });
          setSelected(null);
        } catch (error) {
          toast({ 
            title: 'Failed to delete user', 
            description: (error as Error).message, 
            variant: 'destructive' 
          });
        }
      });
    }
  };

  return (
    <div className="space-y-4">
      <DataTable columns={columns} data={enhanced} searchAccessor="email" onRowClick={(row) => setSelected(row as any)} />
      {selected && (
        <div className="rounded border p-4 space-y-3">
          <h3 className="text-lg font-semibold">{selected.profile.name}</h3>
          <p className="text-sm text-muted-foreground">{selected.profile.email}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => handleClaims('admin')}>Set Admin</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => handleClaims('coach', selected.coachId)}>Set Coach</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => handleClaims('student', selected.coachId)}>Set Student</Button>
            <Button size="sm" variant="destructive" disabled={pending} onClick={handleDisable}>Disable</Button>
            <Button size="sm" disabled={pending} onClick={handleEnable}>Enable</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" disabled={pending}>
                  Delete User
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete User?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p className="font-semibold text-destructive">
                      This action cannot be undone. This will permanently delete:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>User account: {selected.profile.name} ({selected.profile.email})</li>
                      <li>Firebase Authentication account</li>
                      <li>All student progress and quiz attempts</li>
                      <li>All invitation records</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete();
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Forever
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}
