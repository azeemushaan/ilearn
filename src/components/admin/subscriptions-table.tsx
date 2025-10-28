'use client';

import { useMemo, useState, useTransition } from 'react';
import type { Coach, Plan, Subscription } from '@/lib/schemas';
import { DataTable } from '@/components/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { updateSubscriptionAction } from '@/app/admin/(dashboard)/subscriptions/actions';
import { useForm } from 'react-hook-form';
import { toast } from '@/hooks/use-toast';

const STATUS_OPTIONS = ['active', 'past_due', 'awaiting_payment', 'canceled'] as const;
const TIERS = ['free', 'pro', 'enterprise'] as const;

type FilterState = {
  status?: string;
  tier?: string;
  coachId?: string;
};

type FormValues = {
  planId?: string;
  tier?: string;
  seatLimit?: number;
  status?: string;
  currentPeriodEnd?: string;
};

export function SubscriptionsTable({ subscriptions, coaches, plans }: { subscriptions: Subscription[]; coaches: Coach[]; plans: Plan[] }) {
  const [filter, setFilter] = useState<FilterState>({});
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    defaultValues: {
      planId: '',
      tier: undefined,
      seatLimit: undefined,
      status: undefined,
      currentPeriodEnd: undefined,
    },
  });

  const filtered = useMemo(() => subscriptions.filter((subscription) => {
    if (filter.status && subscription.status !== filter.status) return false;
    if (filter.tier && subscription.tier !== filter.tier) return false;
    if (filter.coachId && subscription.coachId !== filter.coachId) return false;
    return true;
  }), [subscriptions, filter]);

  const columns: ColumnDef<Subscription>[] = [
    { accessorKey: 'coachId', header: 'Coach' },
    { accessorKey: 'planId', header: 'Plan' },
    { accessorKey: 'tier', header: 'Tier' },
    { accessorKey: 'seatLimit', header: 'Seats' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
    },
    {
      accessorKey: 'currentPeriodEnd',
      header: 'Renews',
      cell: ({ row }) => formatDate(row.original.currentPeriodEnd),
    },
  ];

  const openDialog = (subscription: Subscription) => {
    setEditing(subscription);
    form.reset({
      planId: subscription.planId,
      tier: subscription.tier,
      seatLimit: subscription.seatLimit,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd ? subscription.currentPeriodEnd.toISOString().split('T')[0] : undefined,
    });
  };

  const handleSubmit = (values: FormValues) => {
    if (!editing) return;
    const payload = new FormData();
    if (values.planId) payload.set('planId', values.planId);
    if (values.tier) payload.set('tier', values.tier);
    if (values.seatLimit != null) payload.set('seatLimit', String(values.seatLimit));
    if (values.status) payload.set('status', values.status);
    if (values.currentPeriodEnd) payload.set('currentPeriodEnd', values.currentPeriodEnd);

    startTransition(async () => {
      try {
        await updateSubscriptionAction(editing.id, payload);
        toast({ title: 'Subscription updated' });
        setEditing(null);
      } catch (error) {
        toast({ title: 'Failed to update subscription', description: (error as Error).message, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select className="h-9 rounded border px-2" value={filter.status ?? ''} onChange={(event) => setFilter((prev) => ({ ...prev, status: event.target.value || undefined }))}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select className="h-9 rounded border px-2" value={filter.tier ?? ''} onChange={(event) => setFilter((prev) => ({ ...prev, tier: event.target.value || undefined }))}>
          <option value="">All tiers</option>
          {TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </select>
        <select className="h-9 rounded border px-2" value={filter.coachId ?? ''} onChange={(event) => setFilter((prev) => ({ ...prev, coachId: event.target.value || undefined }))}>
          <option value="">All coaches</option>
          {coaches.map((coach) => (
            <option key={coach.id} value={coach.id}>
              {coach.displayName}
            </option>
          ))}
        </select>
      </div>
      <DataTable columns={columns} data={filtered} searchAccessor="coachId" onRowClick={openDialog} />
      <Dialog open={!!editing} onOpenChange={(open) => {
        if (!open) setEditing(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update subscription</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={form.handleSubmit(handleSubmit)}>
            <div>
              <Label htmlFor="planId">Plan</Label>
              <select id="planId" className="w-full rounded border px-2 py-2" {...form.register('planId')}>
                <option value="">Unchanged</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="tier">Tier</Label>
              <select id="tier" className="w-full rounded border px-2 py-2" {...form.register('tier')}>
                <option value="">Unchanged</option>
                {TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="seatLimit">Seat limit</Label>
              <Input id="seatLimit" type="number" {...form.register('seatLimit', { valueAsNumber: true })} />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <select id="status" className="w-full rounded border px-2 py-2" {...form.register('status')}>
                <option value="">Unchanged</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="currentPeriodEnd">Current period end</Label>
              <Input id="currentPeriodEnd" type="date" {...form.register('currentPeriodEnd')} />
            </div>
            <Button type="submit" disabled={pending}>
              Save changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
