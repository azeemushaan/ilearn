'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { invoiceSchema } from '@/lib/schemas';
import { z } from 'zod';
import { createInvoiceAction } from '@/app/admin/(dashboard)/coaches/actions';
import { useTransition } from 'react';
import { toast } from '@/hooks/use-toast';

const formSchema = invoiceSchema.pick({ coachId: true, items: true, total: true, currency: true, status: true, dueAt: true });

type FormValues = z.infer<typeof formSchema>;

export function CreateInvoiceDialog({ coachId }: { coachId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      coachId,
      currency: 'PKR',
      status: 'draft',
      items: [{ label: 'Subscription', amount: 0 }],
      total: 0,
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const data = new FormData();
      data.set('coachId', values.coachId);
      data.set('items', JSON.stringify(values.items));
      data.set('total', String(values.total));
      data.set('currency', values.currency);
      data.set('status', values.status);
      if (values.dueAt) data.set('dueAt', new Date(values.dueAt).toISOString());
      try {
        await createInvoiceAction(data);
        toast({ title: 'Invoice created', description: 'Invoice draft saved.' });
        setOpen(false);
      } catch (error) {
        toast({ title: 'Failed to create invoice', description: (error as Error).message, variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Create invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create invoice</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <input type="hidden" {...form.register('coachId')} value={coachId} />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" {...form.register('currency')} />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Input id="status" {...form.register('status')} />
            </div>
            <div>
              <Label htmlFor="total">Total</Label>
              <Input id="total" type="number" step="0.01" {...form.register('total', { valueAsNumber: true })} />
            </div>
            <div>
              <Label htmlFor="dueAt">Due date</Label>
              <Input id="dueAt" type="date" {...form.register('dueAt')} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line items</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => append({ label: '', amount: 0 })}>
                Add item
              </Button>
            </div>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="grid gap-3 md:grid-cols-[2fr_1fr_auto] items-end">
                  <div>
                    <Label>Label</Label>
                    <Input {...form.register(`items.${index}.label` as const)} />
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input type="number" step="0.01" {...form.register(`items.${index}.amount` as const, { valueAsNumber: true })} />
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => remove(index)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={pending}>
            Save invoice
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
