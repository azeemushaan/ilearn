'use client';

import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Plan } from '@/lib/schemas';
import { DataTable } from '@/components/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { createPlanAction, updatePlanAction, archivePlanAction, activatePlanAction } from '@/app/admin/dashboard/plans/actions';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { planSchema } from '@/lib/schemas';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

const formSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  priceUSD: z.number().nonnegative(),
  maxStudents: z.number().int().min(1),
  maxPlaylists: z.number().int().min(1),
  enableQuizGeneration: z.boolean(),
  enableProgressTracking: z.boolean(),
  enableAntiSkip: z.boolean(),
  enableCustomBranding: z.boolean(),
  enableAPIAccess: z.boolean(),
  enablePrioritySupport: z.boolean(),
  isActive: z.boolean(),
  sort: z.number().int(),
});

type FormValues = {
  name: string;
  title: string;
  description?: string;
  priceUSD: number;
  maxStudents: number;
  maxPlaylists: number;
  enableQuizGeneration: boolean;
  enableProgressTracking: boolean;
  enableAntiSkip: boolean;
  enableCustomBranding: boolean;
  enableAPIAccess: boolean;
  enablePrioritySupport: boolean;
  isActive: boolean;
  sort: number;
};

export function PlansManager({ plans }: { plans: Plan[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema as any),
    defaultValues: {
      name: '',
      title: '',
      description: '',
      priceUSD: 0,
      maxStudents: 5,
      maxPlaylists: 1,
      enableQuizGeneration: false,
      enableProgressTracking: false,
      enableAntiSkip: false,
      enableCustomBranding: false,
      enableAPIAccess: false,
      enablePrioritySupport: false,
      isActive: true,
      sort: 0,
    },
  });

  const columns: ColumnDef<Plan>[] = useMemo(() => [
    { accessorKey: 'title', header: 'Title' },
    { accessorKey: 'name', header: 'Name' },
    {
      accessorKey: 'priceUSD',
      header: 'Price (USD)',
      cell: ({ row }) => `$${row.original.priceUSD}`,
    },
    {
      accessorKey: 'maxStudents',
      header: 'Students',
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'default' : 'outline'}>
          {row.original.isActive ? 'Active' : 'Archived'}
        </Badge>
      ),
    },
  ], []);

  const resetForm = (plan?: Plan) => {
    if (plan) {
      form.reset({
        name: plan.name,
        title: plan.title,
        description: plan.description,
        priceUSD: plan.priceUSD,
        maxStudents: plan.maxStudents,
        maxPlaylists: plan.maxPlaylists,
        enableQuizGeneration: plan.enableQuizGeneration,
        enableProgressTracking: plan.enableProgressTracking,
        enableAntiSkip: plan.enableAntiSkip,
        enableCustomBranding: plan.enableCustomBranding,
        enableAPIAccess: plan.enableAPIAccess,
        enablePrioritySupport: plan.enablePrioritySupport,
        isActive: plan.isActive,
        sort: plan.sort,
      });
      setEditingPlan(plan);
    } else {
      form.reset({
        name: '',
        title: '',
        description: '',
        priceUSD: 0,
        maxStudents: 5,
        maxPlaylists: 1,
        enableQuizGeneration: false,
        enableProgressTracking: false,
        enableAntiSkip: false,
        enableCustomBranding: false,
        enableAPIAccess: false,
        enablePrioritySupport: false,
        isActive: true,
        sort: 0,
      });
      setEditingPlan(null);
    }
  };

  const handleSubmit = (values: FormValues) => {
    const payload = new FormData();
    payload.set('name', values.name);
    payload.set('title', values.title);
    if (values.description) payload.set('description', values.description);
    payload.set('priceUSD', String(values.priceUSD));
    payload.set('maxStudents', String(values.maxStudents));
    payload.set('maxPlaylists', String(values.maxPlaylists));
    payload.set('enableQuizGeneration', String(values.enableQuizGeneration));
    payload.set('enableProgressTracking', String(values.enableProgressTracking));
    payload.set('enableAntiSkip', String(values.enableAntiSkip));
    payload.set('enableCustomBranding', String(values.enableCustomBranding));
    payload.set('enableAPIAccess', String(values.enableAPIAccess));
    payload.set('enablePrioritySupport', String(values.enablePrioritySupport));
    payload.set('isActive', String(values.isActive));
    payload.set('sort', String(values.sort));

    startTransition(async () => {
      try {
        if (editingPlan) {
          await updatePlanAction(editingPlan.id, payload);
          toast({ title: 'Plan updated', description: `${values.title} saved.` });
        } else {
          await createPlanAction(payload);
          toast({ title: 'Plan created', description: `${values.title} added.` });
        }
        setDialogOpen(false);
      } catch (error) {
        toast({ title: 'Failed to save plan', description: (error as Error).message, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Plans</h2>
        <Dialog open={dialogOpen} onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) {
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>Create plan</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Edit plan' : 'Create plan'}</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
              <div className="grid gap-3 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" {...form.register('name')} placeholder="e.g., free" />
                </div>
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" {...form.register('title')} placeholder="e.g., Free Plan" />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" {...form.register('description')} placeholder="Plan description" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="priceUSD">Price (USD)</Label>
                    <Input id="priceUSD" type="number" {...form.register('priceUSD', { valueAsNumber: true })} />
                  </div>
                  <div>
                    <Label htmlFor="sort">Sort Order</Label>
                    <Input id="sort" type="number" {...form.register('sort', { valueAsNumber: true })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="maxStudents">Max Students</Label>
                    <Input id="maxStudents" type="number" {...form.register('maxStudents', { valueAsNumber: true })} />
                  </div>
                  <div>
                    <Label htmlFor="maxPlaylists">Max Playlists</Label>
                    <Input id="maxPlaylists" type="number" {...form.register('maxPlaylists', { valueAsNumber: true })} />
                  </div>
                </div>
                <div className="space-y-3 pt-2">
                  <Label className="text-base font-semibold">Features</Label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" {...form.register('enableQuizGeneration')} className="rounded" />
                      <span>AI Quiz Generation</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" {...form.register('enableProgressTracking')} className="rounded" />
                      <span>Progress Tracking</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" {...form.register('enableAntiSkip')} className="rounded" />
                      <span>Anti-Skip Controls</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" {...form.register('enableCustomBranding')} className="rounded" />
                      <span>Custom Branding</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" {...form.register('enableAPIAccess')} className="rounded" />
                      <span>API Access</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" {...form.register('enablePrioritySupport')} className="rounded" />
                      <span>Priority Support</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" {...form.register('isActive')} className="rounded" />
                      <span>Active</span>
                    </label>
                  </div>
                </div>
              </div>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? 'Saving...' : 'Save plan'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={plans} searchAccessor="title" />
      <div className="space-y-2">
        {plans.map((plan) => (
          <div key={plan.id} className="flex items-center justify-between rounded border px-3 py-2">
            <div>
              <div className="font-medium">{plan.title}</div>
              <div className="text-xs text-muted-foreground">
                {plan.maxStudents} students • {plan.maxPlaylists} playlists
                {plan.enableQuizGeneration && ' • AI Quiz'}
                {plan.enableProgressTracking && ' • Tracking'}
                {plan.enableAntiSkip && ' • Anti-Skip'}
                {plan.enableCustomBranding && ' • Branding'}
                {plan.enableAPIAccess && ' • API'}
                {plan.enablePrioritySupport && ' • Priority Support'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDialogOpen(true);
                  resetForm(plan);
                }}
              >
                Edit
              </Button>
              {plan.isActive ? (
                <Button size="sm" variant="ghost" onClick={() => archivePlanAction(plan.id)}>
                  Archive
                </Button>
              ) : (
                <Button size="sm" onClick={() => activatePlanAction(plan.id)}>
                  Activate
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
