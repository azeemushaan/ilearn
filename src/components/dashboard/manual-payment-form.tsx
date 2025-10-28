'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { submitManualPayment } from '@/app/dashboard/billing/actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

const schema = z.object({
  amount: z.number().positive(),
  currency: z.enum(['PKR', 'USD']).default('PKR'),
  reference: z.string().min(3),
  notes: z.string().max(500).optional(),
  bankSlip: z.any().optional(),
});

type FormValues = z.infer<typeof schema>;

export function SubmitManualPaymentForm() {
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'PKR' },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      try {
        const data = new FormData();
        data.set('amount', String(values.amount));
        data.set('currency', values.currency);
        data.set('reference', values.reference);
        if (values.notes) data.set('notes', values.notes);
        const fileList = (values.bankSlip as FileList | undefined) ?? undefined;
        if (fileList && fileList[0]) {
          data.set('bankSlip', fileList[0]);
        }
        await submitManualPayment(data);
        toast({ title: 'Payment submitted', description: 'We will review your payment within 24 hours.' });
        reset();
      } catch (error) {
        toast({ title: 'Submission failed', description: (error as Error).message, variant: 'destructive' });
      }
    });
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="amount">Amount</label>
        <Input id="amount" type="number" step="0.01" {...register('amount', { valueAsNumber: true })} />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="currency">Currency</label>
        <select id="currency" className="h-10 rounded border px-2" {...register('currency')}>
          <option value="PKR">PKR</option>
          <option value="USD">USD</option>
        </select>
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="reference">Bank reference</label>
        <Input id="reference" {...register('reference')} />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="bankSlip">Bank slip</label>
        <Input id="bankSlip" type="file" accept="image/*,application/pdf" {...register('bankSlip')} />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="notes">Notes</label>
        <Textarea id="notes" rows={3} {...register('notes')} />
      </div>
      <Button type="submit" disabled={pending}>
        Submit payment
      </Button>
    </form>
  );
}
