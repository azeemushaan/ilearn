'use client';

import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Plan } from '@/lib/schemas';
import { DataTable } from '@/components/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { createPlanAction, updatePlanAction, archivePlanAction, activatePlanAction } from '@/app/admin/(dashboard)/plans/actions';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { planSchema } from '@/lib/schemas';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

const formSchema = planSchema.omit({ createdAt: true, updatedAt: true, id: true }).extend({
  priceUSD: planSchema.shape.priceUSD.nullish(),
});

type FormValues = {
  title: string;
  tier: 'free' | 'pro' | 'enterprise';
  pricePKR: number;
  priceUSD?: number | null;
  seatLimit: number;
  features: string[];
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
      title: '',
      tier: 'free',
      pricePKR: 0,
      priceUSD: undefined,
      seatLimit: 1,
      features: [],
      isActive: true,
      sort: 0,
    },
  });

  const columns: ColumnDef<Plan>[] = useMemo(() => [
    { accessorKey: 'title', header: 'Title' },
    { accessorKey: 'tier', header: 'Tier' },
    {
      accessorKey: 'pricePKR',
      header: 'Price PKR',
      cell: ({ row }) => formatCurrency(row.original.pricePKR, 'PKR'),
    },
    {
      accessorKey: 'seatLimit',
      header: 'Seats',
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
        title: plan.title,
        tier: plan.tier,
        pricePKR: plan.pricePKR,
        priceUSD: plan.priceUSD ?? undefined,
        seatLimit: plan.seatLimit,
        features: plan.features,
        isActive: plan.isActive,
        sort: plan.sort,
      });
      setEditingPlan(plan);
    } else {
      form.reset({
        title: '',
        tier: 'free',
        pricePKR: 0,
        priceUSD: undefined,
        seatLimit: 1,
        features: [],
        isActive: true,
        sort: 0,
      });
      setEditingPlan(null);
    }
  };

  const handleSubmit = (values: FormValues) => {
    const payload = new FormData();
    payload.set('title', values.title);
    payload.set('tier', values.tier);
    payload.set('pricePKR', String(values.pricePKR));
    if (values.priceUSD != null) payload.set('priceUSD', String(values.priceUSD));
    payload.set('seatLimit', String(values.seatLimit));
    payload.set('features', JSON.stringify(values.features));
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
              <div className="grid gap-3">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" {...form.register('title')} />
                </div>
                <div>
                  <Label htmlFor="tier">Tier</Label>
                  <Input id="tier" {...form.register('tier')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="pricePKR">Price PKR</Label>
                    <Input id="pricePKR" type="number" {...form.register('pricePKR', { valueAsNumber: true })} />
                  </div>
                  <div>
                    <Label htmlFor="priceUSD">Price USD</Label>
                    <Input id="priceUSD" type="number" {...form.register('priceUSD', { valueAsNumber: true })} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="seatLimit">Seat limit</Label>
                  <Input id="seatLimit" type="number" {...form.register('seatLimit', { valueAsNumber: true })} />
                </div>
                <div>
                  <Label htmlFor="features">Features (comma separated)</Label>
                  <Input
                    id="features"
                    {...form.register('features', {
                      setValueAs: (value: string) =>
                        value
                          .split(',')
                          .map((item) => item.trim())
                          .filter(Boolean),
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="sort">Sort order</Label>
                  <Input id="sort" type="number" {...form.register('sort', { valueAsNumber: true })} />
                </div>
              </div>
              <Button type="submit" disabled={pending}>
                Save plan
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
              <div className="text-xs text-muted-foreground">{plan.features.join(', ')}</div>
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
